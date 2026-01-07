import sys
import pandas as pd
import json
import os
from pathlib import Path

def normalize_category(category_name):
    """
    Normalizes category name to match file naming convention.
    e.g., "Writing/Contents" -> "writing_contents"
    """
    if pd.isna(category_name):
        return None
    return str(category_name).lower().replace("/", "_").replace(" ", "_").strip()

def load_metadata(file_path):
    """
    Reads metadata from the first sheet (index 0).
    Expected format: Column 1 = Key, Column 2 = Value
    """
    try:
        df = pd.read_excel(file_path, sheet_name=0, header=None)
        
        metadata = {}
        for index, row in df.iterrows():
            key = row[0]
            val = row[1]
            if pd.notna(key):
                metadata[str(key).strip()] = val if pd.notna(val) else ""
        return metadata
    except Exception as e:
        print(f"Error reading metadata: {e}")
        return {}

def is_duplicate(prompt_text, data_list):
    """
    Checks if a prompt with the same text already exists in the data list.
    """
    for item in data_list:
        if item.get("prompt") == prompt_text:
            return True
    return False

def update_prompts(file_path, metadata):
    """
    Reads prompts from second sheet (index 1) and updates JSON files.
    """
    try:
        df = pd.read_excel(file_path, sheet_name=1, header=0)
        
        prompts_base_path = Path("src/prompts")
        
        # Cache for loaded json content
        category_data_map = {} 
        
        # Load all.json
        all_json_path = prompts_base_path / "all.json"
        all_data = []
        if all_json_path.exists():
            with open(all_json_path, 'r', encoding='utf-8') as f:
                try:
                    all_data = json.load(f)
                except json.JSONDecodeError:
                    all_data = []
        
        new_records_count = 0
        skipped_count = 0
        
        for index, row in df.iterrows():
            category_raw = row.iloc[0]
            prompt_text = row.iloc[1]
            
            # Extract new columns (Comment, Href, Screenshot) - indices 2, 3, 4
            comment = ""
            href = ""
            screenshot = ""
            
            if len(row) > 2:
                val = row.iloc[2]
                comment = val if pd.notna(val) else ""
            if len(row) > 3:
                val = row.iloc[3]
                href = val if pd.notna(val) else ""
            if len(row) > 4:
                val = row.iloc[4]
                screenshot = val if pd.notna(val) else ""
            
            if pd.isna(category_raw) or pd.isna(prompt_text):
                continue
                
            # --- Parse Categories (Handle multiple comma-separated) ---
            # 1. Split by comma and strip whitespace
            # 2. Even if single category, store as list
            categories_list = [str(c).strip() for c in str(category_raw).split(',')]
            
            # Record now stores category as a LIST of strings
            record = {
                "category": categories_list,
                "prompt": prompt_text,
                "comment": comment,
                "href": href,
                "screenshot": screenshot,
                "metadata": metadata
            }

            # Update Specific Category Files
            for cat_name in categories_list:
                category_file = normalize_category(cat_name)
                json_file_path = prompts_base_path / f"{category_file}.json"
                
                # Load if not in map
                if category_file not in category_data_map:
                    if json_file_path.exists():
                         with open(json_file_path, 'r', encoding='utf-8') as f:
                            try:
                                category_data_map[category_file] = json.load(f)
                            except json.JSONDecodeError:
                                category_data_map[category_file] = []
                    else:
                        # Auto-initialize/create new category list in memory
                        # (Will be written to file at the end)
                        category_data_map[category_file] = []

                # Check duplicate in THIS Category
                if not is_duplicate(prompt_text, category_data_map[category_file]):
                    # Store single string for 'category' in specific files? 
                    # OR keep the list format?
                    # Request says: "category": ["document", "education", "etc"] even in json files.
                    # So we use the same 'record' object.
                    category_data_map[category_file].insert(0, record)
                    # We count only unique additions to files? 
                    # Let's just track overall process success.
            
            new_records_count += 1
            
            # --- All.json Handling ---
            # Check duplicate in All.json
            if not is_duplicate(prompt_text, all_data):
                all_data.insert(0, record) # Add to front

            
        # Write back Category files
        for cat_file, data in category_data_map.items():
            json_file_path = prompts_base_path / f"{cat_file}.json"
            with open(json_file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"Updated {cat_file}.json")

        # Write back all.json
        with open(all_json_path, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
        print(f"Updated all.json")
            
        print(f"Process complete. New entries added to categories: {new_records_count}, Skipped (duplicate): {skipped_count}")

    except Exception as e:
        print(f"Error processing prompts: {e}")
        import traceback
        traceback.print_exc()

def main():
    if len(sys.argv) < 2:
        print("Usage: python update_data.py <filename.xlsx>")
        sys.exit(1)
        
    xlsx_file = sys.argv[1]
    
    if not os.path.exists(xlsx_file):
        print(f"File not found: {xlsx_file}")
        sys.exit(1)
        
    print(f"Processing {xlsx_file}...")
    
    metadata = load_metadata(xlsx_file)
    print("Metadata loaded:", metadata)
    
    update_prompts(xlsx_file, metadata)
    print("Done.")

if __name__ == "__main__":
    main()
