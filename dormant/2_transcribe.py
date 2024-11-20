import os
from openai import OpenAI
from dotenv import load_dotenv

# Define the folder paths
input_folder = "./parts/audio_partitions"
output_folder = "./parts/transcripts"

# Create the output folder if it doesn't exist
os.makedirs(output_folder, exist_ok=True)

# Initialize OpenAI client
load_dotenv()
client = OpenAI(
  organization=os.getenv('OPENAI_ORG_ID'),
  project=os.getenv('OPENAI_PROJECT_ID'),
)

# Function to transcribe audio files and export text
def transcribe_audio(file_path, output_folder):
    # Generate the output text file path
    base_name = os.path.splitext(os.path.basename(file_path))[0]
    transcript_path = os.path.join(output_folder, f"{base_name}.txt")
    
    # Skip if transcript already exists
    if os.path.exists(transcript_path):
        print(f"Skipped: {transcript_path} already exists")
        return
    
    try:
        # Open the audio file and transcribe
        with open(file_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model="whisper-1", 
                file=audio_file, 
                response_format="text"
            )
        
        # Write the transcript to a text file
        with open(transcript_path, "w") as text_file:
            text_file.write(transcription)
        
        print(f"Exported: {transcript_path}")
    except Exception as e:
        print(f"Error transcribing {file_path}: {e}")

# Find all .m4a files in the input folder and transcribe them
for file_name in os.listdir(input_folder):
    if file_name.endswith(".m4a"):
        file_path = os.path.join(input_folder, file_name)
        transcribe_audio(file_path, output_folder)
