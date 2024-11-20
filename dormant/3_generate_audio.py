import os
from openai import OpenAI
from dotenv import load_dotenv
from pathlib import Path
from openai import OpenAI
load_dotenv()
client = OpenAI(
  organization='org-UpftbMMrLq5RYH67NQcKmTLd',
  project='proj_ug1fpuLkb23cajbHSYLunWbM'
)

# Define the text file path
tts_text_file_path = "parts/transcripts/D3-Fintech/Day-3---Fintech-Visualization_p_48.txt"
speech_file_path = Path(__file__).parent / "speech.wav"

# Read the text from the file into a variable
with open(tts_text_file_path, "r") as file:
    text_to_speech = file.read()

# Pass the text to the OpenAI API client
response = client.audio.speech.create(
  model="tts-1-hd",
  voice="echo",
  response_format="wav",
  input=text_to_speech
)

# Save the response to a file
response.stream_to_file(speech_file_path)