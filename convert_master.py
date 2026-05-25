import zipfile
import xml.etree.ElementTree as ET
import json

def convert_xlsx_to_json(filepath, json_path):
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
                        text = ""
                        for r in si.findall('main:r', ns):
                            t_r = r.find('main:t', ns)
                            if t_r is not None and t_r.text is not None:
                                text += t_r.text
                        shared_strings.append(text)

            products = []
            if 'xl/worksheets/sheet1.xml' in z.namelist():
                sheet_xml = z.read('xl/worksheets/sheet1.xml')
                root = ET.fromstring(sheet_xml)
                ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                sheetData = root.find('main:sheetData', ns)
                
                headers = []
                
                if sheetData is not None:
                    for i, row in enumerate(sheetData.findall('main:row', ns)):
                        row_data = [""] * 36 # 36列分を確保
                        for c in row.findall('main:c', ns):
                            # c.get('r') == 'A2', 'B2', etc.
                            col_str = ''.join([ch for ch in c.get('r') if ch.isalpha()])
                            
                            # Column index (A=0, B=1, ... Z=25, AA=26)
                            col_idx = 0
                            for ch in col_str:
                                col_idx = col_idx * 26 + (ord(ch) - ord('A') + 1)
                            col_idx -= 1
                            
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
                            
                            if col_idx < 36:
                                row_data[col_idx] = val
                        
                        if i == 0:
                            headers = row_data
                        else:
                            # 辞書にマッピング
                            ident_val = row_data[0] # 識別コード
                            material_val = row_data[4] # 資材コード
                            if not material_val: continue
                            
                            product = {
                                "id": material_val, # システム主キーは資材コードとする
                                "category": row_data[1], # identClass (09など) をセット
                                "name": row_data[8],
                                "price": float(row_data[15]) if row_data[15] else 0,
                                
                                "identCode": row_data[0],
                                "identClass": row_data[1],
                                "identOrder": row_data[2],
                                "materialCode": row_data[4],
                                "materialType": row_data[5],
                                "subCategory": row_data[6],
                                "remarks": row_data[7],
                                
                                "colorOther": row_data[9],
                                "material": row_data[10],
                                "width": row_data[11],
                                "length": row_data[12],
                                "thickness": row_data[13],
                                "unit": row_data[14],
                                
                                "inventoryTarget": row_data[16],
                                "obsoleteFlag": row_data[17],
                                "deadStockQty": int(row_data[18]) if row_data[18] else 0,
                                "prevMonthQty": int(row_data[19]) if row_data[19] else 0,
                                
                                "orderName": row_data[21],
                                "supplier": row_data[22],
                                "supplierCode": row_data[23],
                                "orderLot": row_data[24],
                                "orderLeadTime": row_data[25],
                                "stockItemNumber": row_data[26]
                            }
                            products.append(product)
                            
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(products, f, ensure_ascii=False, indent=2)
            
            print(f"Successfully converted {len(products)} products to {json_path}")
            
    except Exception as e:
        print("Error:", e)

convert_xlsx_to_json('data/棚卸し原簿.xlsx', 'data/new_master.json')
