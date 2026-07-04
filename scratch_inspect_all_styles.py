import xml.etree.ElementTree as ET

drawio_path = r"C:\Users\Hiếu\Downloads\Bản sao của ERP HTQL_TT.drawio"

root_el = ET.fromstring(open(drawio_path, 'r', encoding='utf-8').read())
mx_root = root_el.find('.//root')

for cell in mx_root.findall('mxCell'):
    if cell.get('edge') == '1':
        style = cell.get('style', '')
        has_start = "startArrow=" in style
        has_end = "endArrow=" in style
        print(f"ID: {cell.get('id')}, Source: {cell.get('source')}, Target: {cell.get('target')}")
        print(f"  Style: {style}")
