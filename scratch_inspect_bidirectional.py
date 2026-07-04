import xml.etree.ElementTree as ET

drawio_path = r"C:\Users\Hiếu\Downloads\Bản sao của ERP HTQL_TT.drawio"

root_el = ET.fromstring(open(drawio_path, 'r', encoding='utf-8').read())
mx_root = root_el.find('.//root')

for cell in mx_root.findall('mxCell'):
    if cell.get('id') == 'ToWnF73PojIHbTJaD8Ps-89':
        print(ET.tostring(cell, encoding='utf-8').decode('utf-8'))
