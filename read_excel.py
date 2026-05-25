import zipfile
import xml.etree.ElementTree as ET

def read_xlsx(filepath):
    try:
        with zipfile.ZipFile(filepath, 'r') as z:
            shared_strings = []
            if 'xl/sharedStrings.xml' in z.namelist():
                xml_content = z.read('xl/sharedStrings.xml')
                root = ET.fromstring(xml_content)
                ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for si in root.findall('main:si', ns):
                    t = si.find('main:t', ns)
                    if t is not None and t.text is not None:
                        shared_strings.append(t.text)
                    else:
                        # Handle multi-line or formatted strings (r elements)
                        text = ""
                        for r in si.findall('main:r', ns):
                            t_r = r.find('main:t', ns)
                            if t_r is not None and t_r.text is not None:
                                text += t_r.text
                        shared_strings.append(text)

            if 'xl/worksheets/sheet1.xml' in z.namelist():
                sheet_xml = z.read('xl/worksheets/sheet1.xml')
                root = ET.fromstring(sheet_xml)
                ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                sheetData = root.find('main:sheetData', ns)
                if sheetData is not None:
                    for i, row in enumerate(sheetData.findall('main:row', ns)):
                        row_data = []
                        for c in row.findall('main:c', ns):
                            t = c.get('t')
                            v = c.find('main:v', ns)
                            is_inline = c.find('main:is', ns)
                            
                            val = ""
                            if t == 's' and v is not None:
                                val = shared_strings[int(v.text)]
                            elif t == 'inlineStr' and is_inline is not None:
                                it = is_inline.find('main:t', ns)
                                if it is not None:
                                    val = it.text
                            elif v is not None:
                                val = v.text
                            
                            row_data.append(val)
                        print(f"Row {i+1}: {row_data}")
                        if i >= 5:
                            break
    except Exception as e:
        print("Error:", e)

read_xlsx('data/棚卸し原簿.xlsx')
