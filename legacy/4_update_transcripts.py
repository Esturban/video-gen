import os
import pandas as pd
from openai import OpenAI
from dotenv import load_dotenv
import time
from datetime import datetime

def wait_on_run(run, thread):
    while run.status == "queued" or run.status == "in_progress":
        run = client.beta.threads.runs.retrieve(
            thread_id=thread.id,
            run_id=run.id
        )
        time.sleep(0.5)
    return run

def concatenate_texts(original_talking_point, previous_talking_point, class_details):
    return f"""Current Talking Point (MUST REPHRASE THIS): {original_talking_point} 
Previous Talking Point: {previous_talking_point}
Course Content: {class_details}
    """

def process_record(record, category_thread, previous_talking_point):
    if record['Processed'] == 'No' and not pd.isna(record['Module + Class']) and record['Module + Class'] != '':
        text_1 = record['Original Text']
        class_content = record['Module + Class']
        content = concatenate_texts(text_1, previous_talking_point, class_content)
        print(record['Partition'], f": {record['Folder Name']}")
        
        # Add message to the thread
        thread_message = client.beta.threads.messages.create(
            thread_id=category_thread.id,
            role="user",
            content=content,
        )
        
        # Run the thread
        run = client.beta.threads.runs.create(
            thread_id=category_thread.id,
            assistant_id="asst_aq8EH6NgEy6uZarBm1LP4YlD",
            max_completion_tokens=1000,
            temperature=0.7,
        )
        run = wait_on_run(run, category_thread)
        messages = client.beta.threads.messages.list(thread_id=category_thread.id)
        
        # Add the concatenated content to the new column
        record['New Text'] = messages.data[0].content[0].text.value
        record['Thread ID'] = category_thread.id
        record['Processed'] = 'Yes'
        record['Timestamp'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # Update previous talking point with the last message received
        previous_talking_point = messages.data[0].content[0].text.value
        
    return record, previous_talking_point

# Initialize OpenAI client
load_dotenv()
client = OpenAI(
  organization=os.getenv('OPENAI_ORG_ID'),
  project=os.getenv('OPENAI_PROJECT_ID'),
)

# Read and categorize Excel data
excel_file_path = 'parts/transcripts/transcripts_master_redo.xlsx'
categorized_data = {}

df = pd.read_excel(excel_file_path, sheet_name='Full Transcript')
fieldnames = df.columns.tolist() + ['New Text', 'Thread ID', 'Timestamp']

for _, row in df.iterrows():
    category = row['Folder Name']
    if category not in categorized_data:
        categorized_data[category] = []
    categorized_data[category].append(row)

# Process each category
updated_records = []
for category, records in categorized_data.items():
    # Create a new thread for each category
    category_thread = client.beta.threads.create()
    
    # Initialize previous talking point
    previous_talking_point = ""
    
    for record in records:
        updated_record, previous_talking_point = process_record(record, category_thread, previous_talking_point)
        updated_records.append(updated_record)

# Convert the updated records back to a DataFrame
updated_df = pd.DataFrame(updated_records)
# Create the final folder if it doesn't exist
final_folder_path = 'parts/transcripts/final/'
if not os.path.exists(final_folder_path):
    os.makedirs(final_folder_path)

# Generate the new Excel file path with a timestamp
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
new_excel_file_path = os.path.join(final_folder_path, f'transcripts_updated_{timestamp}.xlsx')

# Write the updated records to a new Excel file
updated_df.to_excel(new_excel_file_path, sheet_name='Full Transcript', index=False)