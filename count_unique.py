import zipfile
import xml.etree.ElementTree as ET

def count():
    filepath = 'data/棚卸し原簿.xlsx'
    with zipfile.ZipFile(filepath, 'r') as z:
        sheet_xml = z.read('xl/worksheets/sheet1.xml')
        root = ET.fromstring(sheet_xml)
        ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        sheetData = root.find('main:sheetData', ns)
        
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            xml_content = z.read('xl/sharedStrings.xml')
            sroot = ET.fromstring(xml_content)
            for si in sroot.findall('main:si', ns):
                t = si.find('main:t', ns)
                if t is not None and t.text is not None:
                    shared_strings.append(t.text)
                else:
                    text = ""
                    for r in si.findall('main:r', ns):
                        t_r = r.find('main:t', ns)
                        if t_r is not None and t_r.text is not None:
                            text += t_r.text
                    shared_strings.append(text)

        ident_codes = set()
        material_codes = set()
        
        for i, row in enumerate(sheetData.findall('main:row', ns)):
            if i == 0: continue
            col_a = ""
            col_e = ""
            for c in row.findall('main:c', ns):
                col_str = ''.join([ch for ch in c.get('r') if ch.isalpha()])
                if col_str not in ['A', 'E']: continue
                
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
                
                if col_str == 'A': col_a = val
                if col_str == 'E': col_e = val
                
            if col_a: ident_codes.add(col_a)
            if col_e: material_codes.add(col_e)

        print(f"Unique 識別コード (Col A): {len(ident_codes)}")
        print(f"Unique 資材コード (Col E): {len(material_codes)}")

count()
