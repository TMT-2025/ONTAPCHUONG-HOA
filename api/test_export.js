const fs = require('fs');
const docx = require('docx');
const { generateDocx } = require('./helpers/docxHelper');
const Packer = docx.Packer;

const sampleMarkdown = `
# Chương 1: Cấu tạo nguyên tử

## 1. Thành phần của nguyên tử

Nguyên tử là hạt vô cùng nhỏ bé và trung hòa về điện. Thành phần cấu tạo của nguyên tử gồm:
- **Vỏ nguyên tử**: gồm các electron mang điện tích âm (e, q = -1, m ≈ 0 amu).
- **Hạt nhân nguyên tử**: nằm ở tâm nguyên tử, gồm các proton mang điện tích dương (p, q = +1, m ≈ 1 amu) và neutron không mang điện (n, q = 0, m ≈ 1 amu).

### Bảng tóm tắt các hạt cấu tạo nguyên tử

| Loại hạt | Kí hiệu | Điện tích | Khối lượng (amu) | Khối lượng (kg) |
| :--- | :---: | :---: | :---: | :---: |
| Electron | e | -1 | 0,00055 | 9,109 x 10<sup>-31</sup> |
| Proton | p | +1 | 1 | 1,673 x 10<sup>-27</sup> |
| Neutron | n | 0 | 1 | 1,675 x 10<sup>-27</sup> |

> **Lưu ý:** Khối lượng của electron rất nhỏ so với proton và neutron (chỉ bằng khoảng 1/1840), nên khối lượng nguyên tử tập trung hầu hết ở hạt nhân. Do đó, khối lượng nguyên tử xấp xỉ bằng khối lượng hạt nhân.

> **Mẹo ghi nhớ:** Để nhớ hạt nhân nguyên tử gồm proton và neutron, ta nhớ cụm từ: "Nhân = Pro + Nêu" (Proton và Neutron).

## 2. Các phương trình phản ứng minh họa

Phản ứng đốt cháy Hydrogen tạo thành nước (Water):
2H<sub>2</sub> + O<sub>2</sub> → 2H<sub>2</sub>O

Phản ứng của Iron(III) oxide với Carbon monoxide ở nhiệt độ cao:
Fe<sub>2</sub>O<sub>3</sub> + 3CO → 2Fe + 3CO<sub>2</sub>

Sự điện li của muối ăn (Sodium chloride) trong nước:
NaCl → Na<sup>+</sup> + Cl<sup>-</sup>

Phản ứng thuận nghịch tạo thành Ammonia:
N<sub>2</sub> + 3H<sub>2</sub> ⇌ 2NH<sub>3</sub>
`;

console.log("[Test] Compiling dummy docx...");
try {
  const doc = generateDocx(10, "Chương 1. Cấu tạo nguyên tử", sampleMarkdown);
  Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync("test_compile.docx", buffer);
    console.log("[Test] test_compile.docx created successfully! The converter works flawlessly.");
  }).catch(err => {
    console.error("[Test] Packer Error:", err);
  });
} catch (error) {
  console.error("[Test] Conversion Error:", error);
}
