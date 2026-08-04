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
  // Normalized characters like arrows and color span tags
  let normalizedText = text
    .replace(/-->/g, ' → ')
    .replace(/<=>/g, ' ⇌ ')
    .replace(/->/g, ' → ')
    .replace(/<span style="color:\s*red;?">(.*?)<\/span>/gi, '<red>$1</red>');

  const regex = /(\*\*.*?\*\*|\*.*?\*|<sub>.*?<\/sub>|<sup>.*?<\/sup>|<red>.*?<\/red>)/;
  
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
    } else if (token.startsWith('<red>')) {
      const innerText = token.slice(5, -6);
      const innerRuns = parseInlineText(innerText, size, "FF0000", bold, italic);
      runs.push(...innerRuns);
    }
    
    remaining = remaining.substring(index + token.length);
  }
  return runs;
}

// Function to check if a paragraph represents a standalone chemical equation
function isChemicalEquation(text) {
  // If it starts with a label like "Hướng dẫn", "Gợi ý", "Lưu ý", or "Mẹo", it's a paragraph containing an equation, not a standalone equation to center
  const lower = text.toLowerCase().trim();
  if (lower.startsWith('hướng dẫn') || lower.startsWith('gợi ý') || lower.startsWith('lưu ý') || lower.startsWith('mẹo')) {
    return false;
  }
  const hasArrow = /[\u2192\u21CC\u2191\u2193]|-->|<=>|->/.test(text);
  const hasSymbols = /[A-Z]/.test(text);
  return hasArrow && hasSymbols;
}

// Helper to detect if a text represents a multiple choice option like A., B., C., D.
function isOption(text, letter) {
  if (!text) return false;
  // Strip any wrapping markdown formatting like **, * or HTML tags
  const clean = text.replace(/^\*\*|^\*|^<span[^>]*>/i, '').trim();
  return clean.toUpperCase().startsWith(letter + '.');
}

// Helper to split a single paragraph containing inline A., B., C., D. options into distinct parts
function splitMCQParagraph(text) {
  const regexA = /(?:^|\s|>)(\*\*A\.\*\*|\*A\.\*|A\.|<span[^>]*>\s*A\.)/i;
  const regexB = /(?:^|\s|>)(\*\*B\.\*\*|\*B\.\*|B\.|<span[^>]*>\s*B\.)/i;
  const regexC = /(?:^|\s|>)(\*\*C\.\*\*|\*C\.\*|C\.|<span[^>]*>\s*C\.)/i;
  const regexD = /(?:^|\s|>)(\*\*D\.\*\*|\*D\.\*|D\.|<span[^>]*>\s*D\.)/i;

  const matchA = text.match(regexA);
  const matchB = text.match(regexB);
  const matchC = text.match(regexC);
  const matchD = text.match(regexD);

  if (matchA && matchB && matchC && matchD) {
    const idxA = text.indexOf(matchA[1]);
    const idxB = text.indexOf(matchB[1], idxA + matchA[1].length);
    const idxC = text.indexOf(matchC[1], idxB + matchB[1].length);
    const idxD = text.indexOf(matchD[1], idxC + matchC[1].length);

    if (idxA !== -1 && idxB > idxA && idxC > idxB && idxD > idxC) {
      return {
        question: text.substring(0, idxA).trim(),
        optA: text.substring(idxA, idxB).trim(),
        optB: text.substring(idxB, idxC).trim(),
        optC: text.substring(idxC, idxD).trim(),
        optD: text.substring(idxD).trim()
      };
    }
  }
  return null;
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

  // Local helper to render a single paragraph (handles callouts, chemical equations, standard text)
  function renderParagraph(pText) {
    if (!pText) return;
    
    // Automatically correct numbering if the AI made a mistake in the sub-headings of exercises:
    let cleanText = pText;
    if (pText.trim().startsWith("1. Phương pháp giải")) {
      cleanText = pText.replace(/^1\./, "2.");
    } else if (pText.trim().startsWith("1. Ví dụ") || pText.trim().startsWith("1. Các ví dụ") || pText.trim().startsWith("1. Ví dụ mẫu")) {
      cleanText = pText.replace(/^1\./, "3.");
    }
    
    // Handle Blockquote / Callout Boxes manually if marked as Notes/Tips in text
    if (cleanText.startsWith('**Lưu ý:**') || cleanText.startsWith('**Mẹo ghi nhớ:**') || cleanText.startsWith('Lưu ý:') || cleanText.startsWith('Mẹo ghi nhớ:')) {
      const isTip = cleanText.includes('Mẹo ghi nhớ');
      const cleanBodyText = cleanText.replace(/^\*\*?(Lưu ý|Mẹo ghi nhớ):\*\*?\s*/i, '');
      const p = new Paragraph({
        children: [
          new TextRun({ text: isTip ? "💡 Mẹo ghi nhớ: " : "⚠️ Lưu ý: ", bold: true, font: "Times New Roman", size: 26, color: isTip ? '1565C0' : 'F57F17' }),
          ...parseInlineText(cleanBodyText, 26, "000000", false)
        ],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: 360, before: 60, after: 60 }
      });
      docChildren.push(createCalloutBox([p], isTip ? 'tip' : 'note'));
      return;
    }
    
    // Handle stand-alone Chemical Equation rendering in center
    if (isChemicalEquation(cleanText)) {
      docChildren.push(new Paragraph({
        children: parseInlineText(cleanText, 26, "000000", false),
        alignment: AlignmentType.CENTER,
        spacing: { before: 180, after: 180 }
      }));
      return;
    }
    
    // Standard paragraph
    docChildren.push(new Paragraph({
      children: parseInlineText(cleanText, 26, "000000", false),
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 360, before: 120, after: 120 }
    }));
  }

  // Local helper to render MCQ options
  function renderMCQ(mcq) {
    // Render the question first
    renderParagraph(mcq.question);
    
    // Layout the options
    const optA = mcq.optA;
    const optB = mcq.optB;
    const optC = mcq.optC;
    const optD = mcq.optD;
    
    const cleanA = optA.replace(/<[^>]+>/g, '').replace(/\*/g, '');
    const cleanB = optB.replace(/<[^>]+>/g, '').replace(/\*/g, '');
    const cleanC = optC.replace(/<[^>]+>/g, '').replace(/\*/g, '');
    const cleanD = optD.replace(/<[^>]+>/g, '').replace(/\*/g, '');
    
    const maxLength = Math.max(cleanA.length, cleanB.length, cleanC.length, cleanD.length);
    
    const runsA = parseInlineText(optA, 26, "000000", false);
    const runsB = parseInlineText(optB, 26, "000000", false);
    const runsC = parseInlineText(optC, 26, "000000", false);
    const runsD = parseInlineText(optD, 26, "000000", false);
    
    if (maxLength <= 15) {
      // Case 1: 1 line (All 4 options on a single line)
      docChildren.push(new Paragraph({
        children: [
          ...runsA,
          new TextRun({ text: "      " }),
          ...runsB,
          new TextRun({ text: "      " }),
          ...runsC,
          new TextRun({ text: "      " }),
          ...runsD
        ],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: 360, before: 60, after: 60 }
      }));
    } else if (maxLength <= 35) {
      // Case 2: 2 lines (2 options per line)
      docChildren.push(new Paragraph({
        children: [
          ...runsA,
          new TextRun({ text: "                    " }), // Spacer
          ...runsB
        ],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: 360, before: 60, after: 40 }
      }));
      docChildren.push(new Paragraph({
        children: [
          ...runsC,
          new TextRun({ text: "                    " }),
          ...runsD
        ],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: 360, before: 40, after: 60 }
      }));
    } else {
      // Case 3: 4 lines (1 option per line, default paragraphs)
      docChildren.push(new Paragraph({ children: runsA, alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, before: 60, after: 40 } }));
      docChildren.push(new Paragraph({ children: runsB, alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, before: 40, after: 40 } }));
      docChildren.push(new Paragraph({ children: runsC, alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, before: 40, after: 40 } }));
      docChildren.push(new Paragraph({ children: runsD, alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, before: 40, after: 60 } }));
    }
  }
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Grouping Multiple-Choice Options (A., B., C., D.) based on length
    if (token.type === 'paragraph' && isOption(token.text, 'A')) {
      const next1 = tokens[i+1];
      const next2 = tokens[i+2];
      const next3 = tokens[i+3];
      
      if (next1 && next1.type === 'paragraph' && isOption(next1.text, 'B') &&
          next2 && next2.type === 'paragraph' && isOption(next2.text, 'C') &&
          next3 && next3.type === 'paragraph' && isOption(next3.text, 'D')) {
        
        const mcq = {
          question: '', // Already rendered or none
          optA: token.text,
          optB: next1.text,
          optC: next2.text,
          optD: next3.text
        };
        
        renderMCQ(mcq);
        i += 3; // Skip next B, C, D tokens
        continue;
      }
    }

    switch (token.type) {
      case 'heading': {
        const text = token.text;
        
        let level, size, color, before, after, alignment = AlignmentType.LEFT;
        const upperText = text.toUpperCase();
        
        if (token.depth === 1) {
          level = HeadingLevel.HEADING_1;
          size = 32; // 16pt
          before = 360;
          after = 180;
          color = 'EE0000'; // All Heading 1 are RED
          
          if (upperText.includes("CHƯƠNG")) {
            alignment = AlignmentType.CENTER; // Center the Chapter Title
          }
          
          // PageBreak before Heading 1, except for the first one
          if (!isFirstHeading1) {
            docChildren.push(new Paragraph({ children: [new PageBreak()] }));
          }
          isFirstHeading1 = false;
        } else if (token.depth === 2) {
          level = HeadingLevel.HEADING_2;
          size = 28; // 14pt
          before = 240;
          after = 120;
          
          if (upperText.includes("NHẬN BIẾT")) {
            color = 'FF00FF'; // Magenta
          } else if (upperText.includes("THÔNG HIỂU")) {
            color = '2E7D32'; // Green
          } else if (upperText.includes("VẬN DỤNG")) {
            color = 'FF0000'; // Red
          } else {
            color = '0033CC'; // Blue (Heading 2 is blue)
          }
        } else if (token.depth === 3) {
          level = HeadingLevel.HEADING_3;
          size = 26; // 13pt
          before = 180;
          after = 90;
          
          if (upperText.includes("NHẬN BIẾT")) {
            color = 'FF00FF'; // Magenta
          } else if (upperText.includes("THÔNG HIỂU")) {
            color = '2E7D32'; // Green
          } else if (upperText.includes("VẬN DỤNG")) {
            color = 'FF0000'; // Red
          } else {
            color = '0033CC'; // Blue (Heading 3 is blue)
          }
        } else {
          level = HeadingLevel.HEADING_4;
          size = 24; // 12pt
          before = 120;
          after = 60;
          
          if (upperText.includes("NHẬN BIẾT")) {
            color = 'FF00FF'; // Magenta
          } else if (upperText.includes("THÔNG HIỂU")) {
            color = '2E7D32'; // Green
          } else if (upperText.includes("VẬN DỤNG")) {
            color = 'FF0000'; // Red
          } else {
            color = '0033CC'; // Blue (Heading 4 is blue)
          }
        }
        
        // Pass style parameters directly to parseInlineText to properly update TextRun XML properties
        const runs = parseInlineText(text, size, color, true);
        
        docChildren.push(new Paragraph({
          heading: level,
          children: runs,
          alignment: alignment,
          spacing: { before, after }
        }));
        break;
      }
      
      case 'paragraph': {
        const text = token.text;
        
        // 1. Check if the paragraph contains inline multiple choice options A., B., C., D.
        const mcq = splitMCQParagraph(text);
        if (mcq) {
          renderMCQ(mcq);
          break;
        }

        // 2. Check if paragraph contains "Gợi ý:" or "Hướng dẫn:" and split them if not already at the start
        let splitMarker = '';
        if (text.includes('**Gợi ý:**')) splitMarker = '**Gợi ý:**';
        else if (text.includes('Gợi ý:')) splitMarker = 'Gợi ý:';
        else if (text.includes('**Hướng dẫn:**')) splitMarker = '**Hướng dẫn:**';
        else if (text.includes('Hướng dẫn:')) splitMarker = 'Hướng dẫn:';
        else if (text.includes('**Hướng dẫn giải:**')) splitMarker = '**Hướng dẫn giải:**';
        else if (text.includes('Hướng dẫn giải:')) splitMarker = 'Hướng dẫn giải:';
        
        if (splitMarker && !text.trim().startsWith(splitMarker)) {
          const splitIndex = text.indexOf(splitMarker);
          const part1 = text.substring(0, splitIndex).trim();
          const part2 = text.substring(splitIndex).trim();
          
          if (part1) renderParagraph(part1);
          if (part2) renderParagraph(part2);
        } else {
          renderParagraph(text);
        }
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
          const rawText = item.text || '';
          
          // Split by newline first, then normalize inline asterisks or bullets to newlines with markers
          let normalized = rawText.replace(/\s+\*\s+/g, '\n* ');
          normalized = normalized.replace(/\s+•\s+/g, '\n• ');
          
          const lines = normalized.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          
          lines.forEach((line, lineIndex) => {
            const runs = [];
            let isSubItem = false;
            let bulletPrefix = "•  ";
            
            // Check if this line is a sub-item
            if (lineIndex > 0 || line.startsWith('*') || line.startsWith('-') || line.startsWith('•')) {
              isSubItem = true;
            }
            
            let cleanLine = line;
            if (line.startsWith('*') || line.startsWith('-') || line.startsWith('•')) {
              const firstChar = line.charAt(0);
              bulletPrefix = `${firstChar}  `;
              cleanLine = line.substring(1).trim();
            } else if (isSubItem) {
              bulletPrefix = "*  ";
            }
            
            if (lineIndex === 0 && !isSubItem) {
              if (token.ordered) {
                runs.push(new TextRun({ text: `${index + 1}. `, bold: true, font: "Times New Roman", size: 26 }));
              } else {
                runs.push(new TextRun({ text: "•  ", bold: true, font: "Times New Roman", size: 26 }));
              }
              runs.push(...parseInlineText(cleanLine, 26, "000000", false));
              
              docChildren.push(new Paragraph({
                children: runs,
                alignment: AlignmentType.JUSTIFIED,
                spacing: { line: 360, before: 60, after: 60 }
              }));
            } else {
              runs.push(new TextRun({ text: bulletPrefix, bold: true, font: "Times New Roman", size: 26 }));
              runs.push(...parseInlineText(cleanLine, 26, "000000", false));
              
              docChildren.push(new Paragraph({
                children: runs,
                alignment: AlignmentType.JUSTIFIED,
                indent: { left: 360 }, // Indent sub-bullets by 360 twips
                spacing: { line: 360, before: 40, after: 40 }
              }));
            }
          });
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
        properties: {
          page: {
            margin: pageMargins
          }
        },
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
        properties: {
          page: {
            margin: pageMargins
          }
        },
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
        properties: {
          page: {
            margin: pageMargins
          }
        },
        children: parsedContent
      }
    ]
  });
}

module.exports = {
  generateDocx
};
