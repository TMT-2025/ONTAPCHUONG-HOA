const docx = require('docx');
const { lexer } = require('marked');

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  TableOfContents,
  PageBreak
} = docx;

// Helper: Convert digits/signs to Unicode subscripts
const unicodeSub = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎'
};

// Helper: Convert digits/signs to Unicode superscripts
const unicodeSup = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ'
};

function toUnicode(text, isSub) {
  const map = isSub ? unicodeSub : unicodeSup;
  return text.split('').map(char => map[char] || char).join('');
}

// Function to recursively parse inline styles (bold, italic, sub, sup) in text
function parseInlineText(text) {
  const runs = [];
  // Normalized characters like arrows
  let normalizedText = text
    .replace(/-->/g, ' → ')
    .replace(/<=>/g, ' ⇌ ')
    .replace(/->/g, ' → ');

  const regex = /(\*\*.*?\*\*|\*.*?\*|<sub>.*?<\/sub>|<sup>.*?<\/sup>)/;
  
  let remaining = normalizedText;
  while (remaining) {
    const match = remaining.match(regex);
    if (!match) {
      runs.push(new TextRun({ 
        text: remaining, 
        font: "Times New Roman", 
        size: 26 // 13pt
      }));
      break;
    }
    
    const index = match.index;
    if (index > 0) {
      runs.push(new TextRun({ 
        text: remaining.substring(0, index), 
        font: "Times New Roman", 
        size: 26 
      }));
    }
    
    const token = match[0];
    if (token.startsWith('**')) {
      const innerText = token.slice(2, -2);
      const innerRuns = parseInlineText(innerText);
      innerRuns.forEach(run => {
        run.bold = true;
      });
      runs.push(...innerRuns);
    } else if (token.startsWith('*')) {
      const innerText = token.slice(1, -1);
      const innerRuns = parseInlineText(innerText);
      innerRuns.forEach(run => {
        run.italic = true;
      });
      runs.push(...innerRuns);
    } else if (token.startsWith('<sub>')) {
      const innerText = token.slice(5, -6);
      const unicodeText = toUnicode(innerText, true);
      runs.push(new TextRun({ 
        text: unicodeText, 
        subScript: true, 
        font: "Times New Roman", 
        size: 26 
      }));
    } else if (token.startsWith('<sup>')) {
      const innerText = token.slice(5, -6);
      const unicodeText = toUnicode(innerText, false);
      runs.push(new TextRun({ 
        text: unicodeText, 
        superScript: true, 
        font: "Times New Roman", 
        size: 26 
      }));
    }
    
    remaining = remaining.substring(index + token.length);
  }
  return runs;
}

// Function to check if a paragraph represents a standalone chemical equation
function isChemicalEquation(text) {
  const hasArrow = /[\u2192\u21CC\u2191\u2193]|-->|<=>|->/.test(text);
  const hasSymbols = /[A-Z]/.test(text);
  return hasArrow && hasSymbols;
}

// Generates a callout box as a single-cell table
function createCalloutBox(contentParagraphs, type) {
  const isTip = type === 'tip';
  const bgColor = isTip ? 'E3F2FD' : 'FFFDE7'; // Light blue vs light yellow
  const borderColor = isTip ? '2196F3' : 'F1C40F'; // Blue vs dark yellow
  
  return new Table({
    width: { size: 100, type: 'pct' },
    margins: { top: 180, bottom: 180, left: 240, right: 240 },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: contentParagraphs,
            shading: { fill: bgColor },
            borders: {
              top: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.SINGLE, size: 24, color: borderColor } // 3pt border
            }
          })
        ]
      })
    ]
  });
}

// Convert parsed Markdown tokens to docx components
function convertMarkdownToDocx(markdownText) {
  const tokens = lexer(markdownText);
  const docChildren = [];
  let isFirstHeading1 = true;
  
  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const text = token.text;
        const runs = parseInlineText(text);
        runs.forEach(run => {
          run.bold = true;
        });
        
        let level, size, color, before, after;
        if (token.depth === 1) {
          level = HeadingLevel.HEADING_1;
          size = 32; // 16pt
          color = '1A365D'; // Dark Blue
          before = 360;
          after = 180;
          
          // PageBreak before Heading 1, except for the first one
          if (!isFirstHeading1) {
            docChildren.push(new Paragraph({ children: [new PageBreak()] }));
          }
          isFirstHeading1 = false;
        } else if (token.depth === 2) {
          level = HeadingLevel.HEADING_2;
          size = 28; // 14pt
          color = '2B6CB0'; // Medium Dark Blue
          before = 240;
          after = 120;
        } else {
          level = HeadingLevel.HEADING_3;
          size = 26; // 13pt
          color = '2D3748'; // Charcoal
          before = 180;
          after = 90;
        }
        
        // Ensure font is Times New Roman and correct size/color
        runs.forEach(run => {
          run.font = "Times New Roman";
          run.size = size;
          run.color = color;
        });
        
        docChildren.push(new Paragraph({
          heading: level,
          children: runs,
          spacing: { before, after }
        }));
        break;
      }
      
      case 'paragraph': {
        const text = token.text;
        
        // Handle Blockquote / Callout Boxes manually if marked as Notes/Tips in text
        if (text.startsWith('**Lưu ý:**') || text.startsWith('**Mẹo ghi nhớ:**') || text.startsWith('Lưu ý:') || text.startsWith('Mẹo ghi nhớ:')) {
          const isTip = text.includes('Mẹo ghi nhớ');
          const cleanText = text.replace(/^\*\*?(Lưu ý|Mẹo ghi nhớ):\*\*?\s*/i, '');
          const p = new Paragraph({
            children: [
              new TextRun({ text: isTip ? "💡 Mẹo ghi nhớ: " : "⚠️ Lưu ý: ", bold: true, font: "Times New Roman", size: 26, color: isTip ? '1565C0' : 'F57F17' }),
              ...parseInlineText(cleanText)
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 360, before: 60, after: 60 }
          });
          docChildren.push(createCalloutBox([p], isTip ? 'tip' : 'note'));
          break;
        }
        
        // Handle stand-alone Chemical Equation rendering in center
        if (isChemicalEquation(text)) {
          docChildren.push(new Paragraph({
            children: parseInlineText(text),
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 180 }
          }));
          break;
        }
        
        // Standard paragraph
        docChildren.push(new Paragraph({
          children: parseInlineText(text),
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: 360, before: 120, after: 120 }
        }));
        break;
      }
      
      case 'blockquote': {
        // Map raw blockquote to Notes / Tips callout boxes
        const subTokens = token.tokens || [];
        const paragraphs = [];
        let isTip = false;
        
        for (const subToken of subTokens) {
          if (subToken.type === 'paragraph') {
            const text = subToken.text;
            if (text.toLowerCase().includes('mẹo ghi nhớ') || text.toLowerCase().includes('tip')) {
              isTip = true;
            }
            paragraphs.push(new Paragraph({
              children: parseInlineText(text),
              alignment: AlignmentType.JUSTIFIED,
              spacing: { line: 360, before: 60, after: 60 }
            }));
          }
        }
        
        if (paragraphs.length > 0) {
          docChildren.push(createCalloutBox(paragraphs, isTip ? 'tip' : 'note'));
        }
        break;
      }
      
      case 'list': {
        const items = token.items || [];
        items.forEach((item, index) => {
          const itemText = item.text || '';
          const runs = [];
          
          // Prepend bullet or numbers directly in text runs to avoid corrupting Word document references
          if (token.ordered) {
            runs.push(new TextRun({ text: `${index + 1}. `, bold: true, font: "Times New Roman", size: 26 }));
          } else {
            runs.push(new TextRun({ text: "•  ", bold: true, font: "Times New Roman", size: 26 }));
          }
          runs.push(...parseInlineText(itemText));
          
          docChildren.push(new Paragraph({
            children: runs,
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 360, before: 60, after: 60 }
          }));
        });
        break;
      }
      
      case 'table': {
        const headers = token.header || [];
        const rows = token.rows || [];
        const tableRows = [];
        
        // Table Header
        const headerCells = headers.map(headerToken => {
          return new TableCell({
            children: [
              new Paragraph({
                children: parseInlineText(headerToken.text),
                bold: true,
                alignment: AlignmentType.CENTER
              })
            ],
            shading: { fill: 'E2E8F0' }, // Light blue-gray background
            margins: { top: 120, bottom: 120, left: 180, right: 180 }
          });
        });
        tableRows.push(new TableRow({ children: headerCells }));
        
        // Table Data Rows
        rows.forEach((row, rowIndex) => {
          const cells = row.map(cellToken => {
            return new TableCell({
              children: [
                new Paragraph({
                  children: parseInlineText(cellToken.text),
                  alignment: AlignmentType.LEFT
                })
              ],
              shading: { fill: rowIndex % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }, // Alternating rows
              margins: { top: 100, bottom: 100, left: 140, right: 140 }
            });
          });
          tableRows.push(new TableRow({ children: cells }));
        });
        
        docChildren.push(new Table({
          width: { size: 100, type: 'pct' },
          rows: tableRows,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 8, color: 'CBD5E1' },
            bottom: { style: BorderStyle.SINGLE, size: 8, color: 'CBD5E1' },
            left: { style: BorderStyle.SINGLE, size: 8, color: 'CBD5E1' },
            right: { style: BorderStyle.SINGLE, size: 8, color: 'CBD5E1' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
            insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }
          }
        }));
        break;
      }
      
      case 'space':
      case 'hr':
      default:
        break;
    }
  }
  
  return docChildren;
}

// Function to generate the full beautiful Document
function generateDocx(grade, chapterTitle, markdownContent) {
  const parsedContent = convertMarkdownToDocx(markdownContent);
  const today = new Date().toLocaleDateString('vi-VN');
  
  return new Document({
    sections: [
      // 1. COVER PAGE
      {
        properties: {},
        children: [
          new Paragraph({ text: "", spacing: { before: 1800 } }), // Top spacing
          new Paragraph({
            children: [
              new TextRun({
                text: "TÀI LIỆU ÔN TẬP CHƯƠNG",
                font: "Times New Roman",
                size: 32, // 16pt
                bold: true,
                color: "718096" // Slate gray
              })
            ],
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({ spacing: { before: 360 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: chapterTitle.toUpperCase(),
                font: "Times New Roman",
                size: 72, // 36pt
                bold: true,
                color: "1A365D" // Premium dark blue
              })
            ],
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({ spacing: { before: 240 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Chương trình Hóa học Lớp ${grade}`,
                font: "Times New Roman",
                size: 36, // 18pt
                italic: true,
                color: "4A5568"
              })
            ],
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Bộ sách: Kết nối tri thức với cuộc sống",
                font: "Times New Roman",
                size: 28, // 14pt
                color: "4A5568"
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 120 }
          }),
          new Paragraph({ text: "", spacing: { before: 3600 } }), // Large spacing down
          new Paragraph({
            children: [
              new TextRun({
                text: `Ngày biên soạn: ${today}`,
                font: "Times New Roman",
                size: 24, // 12pt
                color: "718096"
              })
            ],
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Ứng dụng Chemistry Chapter Review Generator (AI Powered)",
                font: "Times New Roman",
                size: 20, // 10pt
                italic: true,
                color: "A0AEC0"
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 120 }
          }),
          new Paragraph({ children: [new PageBreak()] })
        ]
      },
      // 2. TABLE OF CONTENTS
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "Mục lục tự động",
                font: "Times New Roman",
                size: 36, // 18pt
                bold: true,
                color: "1A365D"
              })
            ],
            spacing: { before: 240, after: 240 }
          }),
          new TableOfContents("Mục lục", {
            hyperlink: true,
            headingStyleRange: "1-3"
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Lưu ý: Sau khi mở file Word, vui lòng nhấn chuột phải vào vùng mục lục ở trên và chọn 'Update Field' để hiển thị đầy đủ số trang chính xác.",
                font: "Times New Roman",
                size: 20, // 10pt
                italic: true,
                color: "718096"
              })
            ],
            spacing: { before: 240 }
          }),
          new Paragraph({ children: [new PageBreak()] })
        ]
      },
      // 3. CORE DOCUMENT CONTENT
      {
        properties: {},
        children: parsedContent
      }
    ]
  });
}

module.exports = {
  generateDocx
};
