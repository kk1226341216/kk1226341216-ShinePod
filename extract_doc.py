import docx2txt
import sys

# 读取docx文档
try:
    text = docx2txt.process('/Users/keke/Downloads/AIShinePod/拾光豆（ShinePod）全栈开发设计文档 V1.3.docx')
    # 寻找文档的关键部分
    print("=== 寻找项目概述部分 ===")
    project_overview_start = text.lower().find("项目概述")
    if project_overview_start != -1:
        print(text[max(0, project_overview_start-100):project_overview_start+5000])
    else:
        print("未找到项目概述部分")
    
    print("\n=== 寻找功能需求部分 ===")
    func_requirements_start = text.lower().find("功能需求")
    if func_requirements_start != -1:
        print(text[max(0, func_requirements_start-100):func_requirements_start+5000])
    else:
        print("未找到功能需求部分")
    
    print("\n=== 寻找技术架构部分 ===")
    tech_arch_start = text.lower().find("技术架构")
    if tech_arch_start != -1:
        print(text[max(0, tech_arch_start-100):tech_arch_start+5000])
    else:
        print("未找到技术架构部分")
    
    print("\n=== 寻找数据结构部分 ===")
    data_struct_start = text.lower().find("数据结构")
    if data_struct_start != -1:
        print(text[max(0, data_struct_start-100):data_struct_start+5000])
    else:
        print("未找到数据结构部分")

except Exception as e:
    print(f"读取文档时出错: {e}")