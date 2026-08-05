const fs = require('fs');
const docx = require('docx');
const { generateDocx } = require('./helpers/docxHelper');
const Packer = docx.Packer;

const sampleMarkdown = `
# Chương 3: Thực hành hóa học và công nghệ thông tin

## 1. Vẽ cấu trúc phân tử với ChemDraw
Khi vẽ cấu trúc phân tử, ta có thể biểu diễn bằng thẻ <molecule> hoặc <atom> trong định dạng XML.
Ví dụ: <molecule id="H2O">
  <atomArray>
    <atom id="a1" elementType="O"/>
  </atomArray>
</molecule>

Một số phím tắt thông dụng:
- \`Ctrl + C\`: Sao chép
- \`Ctrl + V\`: Dán
- \`Ctrl + S\`: Lưu tệp tin

| Định dạng | Thẻ | Ví dụ |
| :--- | :---: | :---: |
| CML | <cml> | <cml><molecule/></cml> |
| SMILES | C=C | CH2=CH2 |

nHOOC-(CH<sub>2</sub>)<sub>4</sub>-COOH + nH<sub>2</sub>N-(CH<sub>2</sub>)<sub>6</sub>-NH<sub>2</sub> <span style="display:inline-block; transform: scaleY(1.5);">→</span> [-CO-(CH<sub>2</sub>)<sub>4</sub>-CO-NH-(CH<sub>2</sub>)<sub>6</sub>-NH-]<sub>n</sub> + 2nH<sub>2</sub>O (điều kiện: nhiệt độ, xúc tác)

> **Lưu ý:** Cần chú ý các thẻ đóng mở để tránh lỗi cú pháp.
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
