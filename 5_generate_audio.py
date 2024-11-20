import os
import pandas as pd
from openai import OpenAI
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime

# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = OpenAI(
  organization=os.getenv('OPENAI_ORG_ID'),
  project=os.getenv('OPENAI_PROJECT_ID'),
)

# Parameters for the audio module
audio_model = "tts-1-hd"
audio_voice = "shimmer"
audio_response_format = "wav"

# Load the Excel file
xlsx_file_path = "parts/transcripts/transcripts_master_redo.xlsx"
df = pd.read_excel(xlsx_file_path)

# Iterate through the records
for index, row in df.iterrows():
    if row['Processed'] == 'Yes' and not pd.isna(row['Final Script']) and row['Final Script'] != '' and row['Ready for Audio']=='Yes' and (row['Final Audio'] == '' or pd.isna(row['Final Audio'])):
        folder_name = row['Folder Name']
        final_script = row['Final Script']
        
        # Define the output directory and ensure it exists
        output_dir = Path(f"parts/audio/final/{folder_name}")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Define the output file path with a suffix for the voice
        speech_file_path = output_dir / f"{row['Folder Name']}_{row['Partition']}_{audio_voice}.wav"
        
        # Pass the text to the OpenAI API client and save the response to a file
        with open(speech_file_path, "wb") as audio_file:
            response = client.audio.speech.create(
                model=audio_model,
                voice=audio_voice,
                response_format=audio_response_format,
                input=final_script
            )
            response.write_to_file(speech_file_path)
        
        # Write the file path to the 'Final Audio' column
        df.at[index, 'Final Audio'] = str(speech_file_path)
        
        print(f"Exported: {speech_file_path}")

# Define the output directory for the Excel file and ensure it exists
output_excel_dir = Path("parts/transcripts/final/audio")
output_excel_dir.mkdir(parents=True, exist_ok=True)

# Define the timestamped output file path
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
output_excel_path = output_excel_dir / f"transcripts_w_audio_{timestamp}.xlsx"

# Save the updated DataFrame to the timestamped Excel file
df.to_excel(output_excel_path, index=False)

print(f"Excel file saved to: {output_excel_path}")