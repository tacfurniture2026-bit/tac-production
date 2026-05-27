import glob, csv
import chardet
for f in glob.glob('inventory_data/*.csv'):
    with open(f, 'rb') as file:
        raw = file.read(10000)
        enc = chardet.detect(raw)['encoding']
        print(f"{f}: {enc}")
