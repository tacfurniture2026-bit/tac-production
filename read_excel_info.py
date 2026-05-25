import zipfile
import xml.etree.ElementTree as ET

def read_xlsx_info(filepath):
    try:
        with zipfile.ZipFile(filepath, 'r') as z:
            print("Files in zip:")
            for info in z.infolist():
                print(info.filename)
                
            if 'xl/workbook.xml' in z.namelist():
                xml_content = z.read('xl/workbook.xml')
                root = ET.fromstring(xml_content)
                ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                sheets = root.find('main:sheets', ns)
                if sheets is not None:
                    print("\nSheets found:")
                    for sheet in sheets.findall('main:sheet', ns):
                        print(sheet.attrib)
    except Exception as e:
        print("Error:", e)

read_xlsx_info('data/棚卸し原簿.xlsx')
