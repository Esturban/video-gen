import os
from pydub import AudioSegment

# Define the folder paths
input_folder = "./parts"
output_folder = "./parts/audio_partitions"

# Create the output folder if it doesn't exist
os.makedirs(output_folder, exist_ok=True)

# Define the maximum size for each partition in bytes (25MB)
max_size = 25 * 1024 * 1024

# Function to partition and export audio files
def partition_audio(file_path, max_size, output_folder):
    # Load the audio file
    audio = AudioSegment.from_file(file_path)
    
    # Handle cases where the audio length is zero
    if len(audio) == 0:
        print(f"Error: The audio file {file_path} has a length of 0.")
        return
    
    # Calculate the duration per partition based on max_size
    bytes_per_ms = len(audio.raw_data) / len(audio)
    partition_duration_ms = max_size / bytes_per_ms
    
    # Split and export the audio
    start = 0
    part_number = 1
    while start < len(audio):
        end = start + partition_duration_ms
        partition = audio[start:end]
        partition_path = os.path.join(output_folder, f"{os.path.splitext(os.path.basename(file_path))[0]}_p_{part_number}.m4a")
        
        # Skip if partition already exists
        if os.path.exists(partition_path):
            print(f"Skipped: {partition_path} already exists")
            start = end
            part_number += 1
            continue
        
        partition.export(partition_path, format="ipod")  # use 'ipod' for m4a format
        print(f"Exported: {partition_path}")
        
        start = end
        part_number += 1

# Find all .m4a files in the input folder and partition them
for file_name in os.listdir(input_folder):
    if file_name.endswith(".m4a"):
        file_path = os.path.join(input_folder, file_name)
        partition_audio(file_path, max_size, output_folder)
