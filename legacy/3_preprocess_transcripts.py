import os
import glob
import csv

# Define the folder paths
input_folder = "./parts/transcripts"

# Function to read and concatenate text files with the same prefix
def collect_and_collate_text_files(prefix, input_folder):
    text_data = ""
    for file_path in sorted(glob.glob(os.path.join(input_folder, f"{prefix}_p_*.txt"))):
        with open(file_path, "r") as file:
            text_data += file.read() + " "
    return text_data

# Function to process each subfolder and create a CSV file
def process_subfolders(input_folder):
    all_csv_data = []
    for subfolder in os.listdir(input_folder):
        subfolder_path = os.path.join(input_folder, subfolder)
        if os.path.isdir(subfolder_path):
            csv_data = []
            for file_path in sorted(glob.glob(os.path.join(subfolder_path, "*.txt"))):
                partition = os.path.basename(file_path).split('_')[-1].split('.')[0]
                with open(file_path, "r") as file:
                    text = file.read()
                csv_data.append([partition, subfolder, text])
                all_csv_data.append([partition, subfolder, text])
            
            # Save the CSV file in the corresponding subfolder
            csv_file_path = os.path.join(subfolder_path, f"{subfolder}.csv")
            with open(csv_file_path, "w", newline='') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow(["Partition", "Folder Name", "Text"])
                writer.writerows(csv_data)
    
    # Collate all CSV data into a single CSV file
    all_csv_file_path = os.path.join(input_folder, "all_transcripts.csv")
    with open(all_csv_file_path, "w", newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["Partition", "Folder Name", "Text"])
        writer.writerows(all_csv_data)

# Run the processing function
process_subfolders(input_folder)