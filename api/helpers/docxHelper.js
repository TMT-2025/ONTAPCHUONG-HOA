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
  PageBreak,
  Header,
  PageNumber
} = docx;

// Helper: Sanitize LaTeX math syntax and convert it to readable Unicode text
function sanitizeMarkdown(text) {
  if (!text) return '';
  let clean = text;
  
  // 1. Replace standard LaTeX math commands with Unicode counterparts
  clean = clean.replace(/\\Delta/g, 'Δ');
  clean = clean.replace(/\\Sigma/g, 'Σ');
  clean = clean.replace(/\\sum/g, 'Σ');
  clean = clean.replace(/\\cdot/g, '·');
  clean = clean.replace(/\\quad/g, '   ');
  clean = clean.replace(/\\text\{\s*(.*?)\s*\}/g, '$1');
  clean = clean.replace(/\\rightarrow/g, ' → ');
  clean = clean.replace(/\\rightleftharpoons/g, ' ⇌ ');
  clean = clean.replace(/\\to/g, ' → ');
  
  // 2. Parse LaTeX fractions: \frac{numerator}{denominator} -> (numerator / denominator)
  clean = clean.replace(/\\frac\s*\{\s*(.*?)\s*\}\s*\{\s*(.*?)\s*\}/g, '($1 / $2)');
  
  // 3. Parse LaTeX subscript/superscript groupings:
  // e.g., C_{12} -> C<sub>12</sub>  and  SO_4^{2-} -> SO<sub>4</sub><sup>2-</sup>
  clean = clean.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
  clean = clean.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
  
  // 4. Parse LaTeX single-character subscript/superscripts:
  // e.g., H_2 -> H<sub>2</sub>  and  O^2 -> O<sup>2</sup>
  // Only match characters immediately following _ or ^ if they are not already inside tags
  clean = clean.replace(/_([a-zA-Z0-9+\-]+)(?![^<]*>)/g, '<sub>$1</sub>');
  clean = clean.replace(/\^([a-zA-Z0-9+\-]+)(?![^<]*>)/g, '<sup>$1</sup>');
  
  // 5. Strip math environment dollar signs ($...$ and $$...$$)
  clean = clean.replace(/\$\$(.*?)\$\$/g, '$1');
  clean = clean.replace(/\$([^$]+)\$/g, '$1');

  // 6. Strip empty tag artifacts that might result from translations
  clean = clean.replace(/<sub><\/sub>/g, '');
  clean = clean.replace(/<sup><\/sup>/g, '');

  return clean;
}

// Function to recursively parse inline styles (bold, italic, sub, sup) in text
// Accept sizing and coloring options to correctly apply styles to instantiated TextRuns
function parseInlineText(text, size = 26, color = "000000", bold = false, italic = false) {
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
        size: size,
        color: color,
        bold: bold,
        italic: italic
      }));
      break;
    }
    
    const index = match.index;
    if (index > 0) {
      runs.push(new TextRun({ 
        text: remaining.substring(0, index), 
        font: "Times New Roman", 
        size: size,
        color: color,
        bold: bold,
        italic: italic
      }));
    }
    
    const token = match[0];
    if (token.startsWith('**')) {
      const innerText = token.slice(2, -2);
      const innerRuns = parseInlineText(innerText, size, color, true, italic);
      runs.push(...innerRuns);
    } else if (token.startsWith('*')) {
      const innerText = token.slice(1, -1);
      const innerRuns = parseInlineText(innerText, size, color, bold, true);
      runs.push(...innerRuns);
    } else if (token.startsWith('<sub>')) {
      const innerText = token.slice(5, -6);
      // Increased size: size + 2 (so for 13pt body text it becomes 14pt (size 28), shrunk to ~10.5pt in Word)
      runs.push(new TextRun({ 
        text: innerText, 
        subScript: true, 
        font: "Times New Roman", 
        size: size + 2,
        color: color,
        bold: bold,
        italic: italic
      }));
    } else if (token.startsWith('<sup>')) {
      const innerText = token.slice(5, -6);
      runs.push(new TextRun({ 
        text: innerText, 
        superScript: true, 
        font: "Times New Roman", 
        size: size + 2,
        color: color,
        bold: bold,
        italic: italic
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
  // Apply sanitization to clear all LaTeX formatting before parsing
  const sanitizedText = sanitizeMarkdown(markdownText);
  const tokens = lexer(sanitizedText);
  const docChildren = [];
  let isFirstHeading1 = true;
  
  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const text = token.text;
        
        let level, size, color, before, after;
        if (token.depth === 1) {
          level = HeadingLevel.HEADING_1;
          size = 32; // 16pt
          
          // Style Heading 1 colors based on DINH DANG VAN BAN.pdf
          const upperText = text.toUpperCase();
          if (upperText.includes("TỔNG HỢP KIẾN THỨC") || upperText.includes("TÀI LIỆU ÔN TẬP")) {
            color = '0056B3'; // Blue
          } else {
            color = 'FF0000'; // Red
          }
          
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
          color = '0056B3'; // Blue (all Heading 2 are blue)
          before = 240;
          after = 120;
        } else {
          level = HeadingLevel.HEADING_3;
          size = 26; // 13pt
          
          // Style Heading 3 colors based on DINH DANG VAN BAN.pdf
          const upperText = text.toUpperCase();
          if (upperText.includes("NHẬN BIẾT") || upperText.includes("VẬN DỤNG")) {
            color = 'FF0000'; // Red
          } else if (upperText.includes("THÔNG HIỂU")) {
            color = '2E7D32'; // Green
          } else {
            color = '0056B3'; // Blue (Default heading color)
          }
          
          before = 180;
          after = 90;
        }
        
        // Pass style parameters directly to parseInlineText to properly update TextRun XML properties
        const runs = parseInlineText(text, size, color, true);
        
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
              ...parseInlineText(cleanText, 26, "000000", false)
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
            children: parseInlineText(text, 26, "000000", false),
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 180 }
          }));
          break;
        }
        
        // Standard paragraph
        docChildren.push(new Paragraph({
          children: parseInlineText(text, 26, "000000", false),
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
              children: parseInlineText(text, 26, "000000", false),
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
          
          if (token.ordered) {
            runs.push(new TextRun({ text: `${index + 1}. `, bold: true, font: "Times New Roman", size: 26 }));
          } else {
            runs.push(new TextRun({ text: "•  ", bold: true, font: "Times New Roman", size: 26 }));
          }
          runs.push(...parseInlineText(itemText, 26, "000000", false));
          
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
                children: parseInlineText(headerToken.text, 26, "1A365D", true),
                alignment: AlignmentType.CENTER
              })
            ],
            shading: { fill: 'E2E8F0' },
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
                  children: parseInlineText(cellToken.text, 26, "000000", false),
                  alignment: AlignmentType.LEFT
                })
              ],
              shading: { fill: rowIndex % 2 === 0 ? 'FFFFFF' : 'F8FAFC' },
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

// Helper to create page number in the header (centered at the top of the page)
function createPageNumberHeader() {
  return {
    default: new Header({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              children: [PageNumber.CURRENT],
              font: "Times New Roman",
              size: 24, // 12pt
              color: "000000"
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 }
        })
      ]
    })
  };
}

// Function to generate the full beautiful Document
function generateDocx(grade, chapterTitle, markdownContent) {
  const parsedContent = convertMarkdownToDocx(markdownContent);
  const today = new Date().toLocaleDateString('vi-VN');
  const pageHeader = createPageNumberHeader();
  
  const pageMargins = {
    top: 1134,   // 2cm in twips (dxa)
    bottom: 1134,
    left: 1134,
    right: 1134
  };
  
  return new Document({
    features: {
      updateFields: true
    },
    sections: [
      // 1. COVER PAGE (with page number 1 in header as in PDF)
      {
        headers: pageHeader,
        margins: pageMargins,
        children: [
          new Paragraph({ text: "", spacing: { before: 1800 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: "TÀI LIỆU ÔN TẬP CHƯƠNG",
                font: "Times New Roman",
                size: 32,
                bold: true,
                color: "718096"
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
                size: 72,
                bold: true,
                color: "1A365D"
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
                size: 36,
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
                size: 28,
                color: "4A5568"
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 120 }
          }),
          new Paragraph({ text: "", spacing: { before: 3600 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Ngày biên soạn: ${today}`,
                font: "Times New Roman",
                size: 24,
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
                size: 20,
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
      // 2. TABLE OF CONTENTS (with page number 2 in header)
      {
        headers: pageHeader,
        margins: pageMargins,
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "Mục lục tự động",
                font: "Times New Roman",
                size: 36,
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
          new Paragraph({ children: [new PageBreak()] })
        ]
      },
      // 3. CORE DOCUMENT CONTENT (with page numbers 3, 4, 5... in header)
      {
        headers: pageHeader,
        margins: pageMargins,
        children: parsedContent
      }
    ]
  });
}

module.exports = {
  generateDocx
};
