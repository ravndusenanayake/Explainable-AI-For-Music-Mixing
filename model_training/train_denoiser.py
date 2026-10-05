import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import torchaudio
import numpy as np

# ==========================================
# 1. Dataset Loader for VoiceBank-DEMAND
# ==========================================
class NoisyCleanDataset(Dataset):
    def __init__(self, clean_dir, noisy_dir, sample_rate=16000, duration=2.0):
        self.clean_dir = clean_dir
        self.noisy_dir = noisy_dir
        self.sample_rate = sample_rate
        self.num_samples = int(sample_rate * duration)
        
        # Get list of files (assuming filenames match between noisy and clean)
        self.files = [f for f in os.listdir(clean_dir) if f.endswith('.wav')]
        
    def __len__(self):
        return len(self.files)
        
    def __getitem__(self, idx):
        file_name = self.files[idx]
        clean_path = os.path.join(self.clean_dir, file_name)
        noisy_path = os.path.join(self.noisy_dir, file_name)
        
        import soundfile as sf
        c_audio, sr1 = sf.read(clean_path, dtype='float32')
        n_audio, sr2 = sf.read(noisy_path, dtype='float32')
        
        if c_audio.ndim == 1:
            clean_audio = torch.from_numpy(c_audio).unsqueeze(0)
        else:
            clean_audio = torch.from_numpy(c_audio).transpose(0, 1)
            
        if n_audio.ndim == 1:
            noisy_audio = torch.from_numpy(n_audio).unsqueeze(0)
        else:
            noisy_audio = torch.from_numpy(n_audio).transpose(0, 1)
        
        # Resample if needed
        if sr1 != self.sample_rate:
            clean_audio = torchaudio.transforms.Resample(sr1, self.sample_rate)(clean_audio)
        if sr2 != self.sample_rate:
            noisy_audio = torchaudio.transforms.Resample(sr2, self.sample_rate)(noisy_audio)
            
        # Pad or truncate to fixed length
        clean_audio = self._pad_or_truncate(clean_audio)
        noisy_audio = self._pad_or_truncate(noisy_audio)
        
        return noisy_audio, clean_audio
        
    def _pad_or_truncate(self, audio):
        if audio.shape[1] > self.num_samples:
            # truncate
            return audio[:, :self.num_samples]
        elif audio.shape[1] < self.num_samples:
            # pad
            pad_amount = self.num_samples - audio.shape[1]
            return torch.nn.functional.pad(audio, (0, pad_amount))
        return audio


# ==========================================
# 2. Simple U-Net Architecture for Audio Denoising
# ==========================================
class AudioUNet(nn.Module):
    def __init__(self):
        super(AudioUNet, self).__init__()
        
        # Encoder (Downsampling)
        self.enc1 = nn.Sequential(nn.Conv1d(1, 16, kernel_size=15, stride=2, padding=7), nn.LeakyReLU())
        self.enc2 = nn.Sequential(nn.Conv1d(16, 32, kernel_size=15, stride=2, padding=7), nn.LeakyReLU())
        self.enc3 = nn.Sequential(nn.Conv1d(32, 64, kernel_size=15, stride=2, padding=7), nn.LeakyReLU())
        
        # Bottleneck
        self.bottleneck = nn.Sequential(nn.Conv1d(64, 64, kernel_size=15, stride=1, padding=7), nn.LeakyReLU())
        
        # Decoder (Upsampling)
        self.dec1 = nn.Sequential(nn.ConvTranspose1d(128, 32, kernel_size=15, stride=2, padding=7, output_padding=1), nn.LeakyReLU())
        self.dec2 = nn.Sequential(nn.ConvTranspose1d(64, 16, kernel_size=15, stride=2, padding=7, output_padding=1), nn.LeakyReLU())
        self.dec3 = nn.Sequential(nn.ConvTranspose1d(32, 1, kernel_size=15, stride=2, padding=7, output_padding=1), nn.Tanh())
        
    def forward(self, x):
        e1 = self.enc1(x)
        e2 = self.enc2(e1)
        e3 = self.enc3(e2)
        
        b = self.bottleneck(e3)
        
        d1 = self.dec1(torch.cat([b, e3], dim=1))
        d2 = self.dec2(torch.cat([d1, e2], dim=1))
        out = self.dec3(torch.cat([d2, e1], dim=1))
        
        return out

# ==========================================
# 3. Training Loop
# ==========================================
def train_model():
    # Setup Device
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Training on device: {device}")
    
    # ⚠️ EDIT THESE PATHS AFTER DOWNLOADING THE DATASET
    CLEAN_TRAIN_DIR = r"C:\Explainable Music Mixing AI\dataset noise\clean_trainset_28spk_wav"
    NOISY_TRAIN_DIR = r"C:\Explainable Music Mixing AI\dataset noise\noisy_trainset_28spk_wav"
    
    if not os.path.exists(CLEAN_TRAIN_DIR) or not os.path.exists(NOISY_TRAIN_DIR):
        print("ERROR: Dataset folders not found!")
        print("Please download the VoiceBank-DEMAND dataset from Kaggle and extract it to 'dataset/' folder.")
        return

    # Create Dataloader
    dataset = NoisyCleanDataset(CLEAN_TRAIN_DIR, NOISY_TRAIN_DIR)
    dataloader = DataLoader(dataset, batch_size=16, shuffle=True)
    
    # Initialize Model, Loss, and Optimizer
    model = AudioUNet().to(device)
    criterion = nn.L1Loss() # L1 Loss (MAE) works well for audio
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    
    num_epochs = 50
    print("Starting training...")
    
    for epoch in range(num_epochs):
        model.train()
        running_loss = 0.0
        
        for i, (noisy, clean) in enumerate(dataloader):
            noisy, clean = noisy.to(device), clean.to(device)
            
            # Forward pass
            outputs = model(noisy)
            loss = criterion(outputs, clean)
            
            # Backward and optimize
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item()
            
            if (i+1) % 10 == 0:
                print(f'Epoch [{epoch+1}/{num_epochs}], Step [{i+1}/{len(dataloader)}], Loss: {loss.item():.4f}')
                
        epoch_loss = running_loss / len(dataloader)
        print(f"End of Epoch {epoch+1} - Average Loss: {epoch_loss:.4f}")
        
        # Save checkpoint
        if (epoch+1) % 10 == 0:
            torch.save(model.state_dict(), f'denoiser_model_epoch_{epoch+1}.pth')
            print(f"Model saved: denoiser_model_epoch_{epoch+1}.pth")
            
    # Save final model
    torch.save(model.state_dict(), 'denoiser_model_final.pth')
    print("Training finished! Final model saved as 'denoiser_model_final.pth'")

if __name__ == "__main__":
    train_model()
