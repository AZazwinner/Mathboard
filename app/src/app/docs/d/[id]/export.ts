


export type ExportBlock = { id: string; content: string }

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function slugifyFilename(title: string): string {
  return title.trim().replace(/[/\\?%*:|"<>]/g, "-") || "Untitled"
}

export function downloadMarkdown(title: string, blocks: ExportBlock[]) {
  const body = blocks.map((b) => b.content).join("\n\n")
  triggerDownload(`${slugifyFilename(title)}.md`, `# ${title}\n\n${body}\n`, "text/markdown;charset=utf-8")
}


function stripMarkdownSyntax(source: string): string {
  return source
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^```.*$/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "- ")
}

export function downloadPlainText(title: string, blocks: ExportBlock[]) {
  const body = blocks.map((b) => stripMarkdownSyntax(b.content)).join("\n\n")
  triggerDownload(`${slugifyFilename(title)}.txt`, `${title}\n\n${body}\n`, "text/plain;charset=utf-8")
}






function buildStandaloneHtml(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/katex.min.css">
<style>
  body { font-family: Georgia, "Times New Roman", serif; line-height: 1.625; max-width: 44rem; margin: 3rem auto; padding: 0 1.5rem; color: #1c1b1a; background: #ffffff; }
  img { max-width: 100%; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 0.25rem 0.5rem; }
  pre { background: #f4f4f4; padding: 0.75rem; overflow-x: auto; border-radius: 6px; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`
}

export function downloadHtml(title: string, bodyHtml: string) {
  triggerDownload(`${slugifyFilename(title)}.html`, buildStandaloneHtml(title, bodyHtml), "text/html;charset=utf-8")
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}



const PDF_THEME_OVERRIDES = `
  :root {
    --background: #ffffff; --foreground: #1c1b1a;
    --card: #ffffff; --card-foreground: #1c1b1a;
    --popover: #ffffff; --popover-foreground: #1c1b1a;
    --muted: #f5f5f5; --muted-foreground: #737373;
    --border: #e5e5e5; --input: #e5e5e5;
  }
  .dark {
    --background: #0a0a0a; --foreground: #fafafa;
    --card: #171717; --card-foreground: #fafafa;
    --popover: #171717; --popover-foreground: #fafafa;
    --muted: #262626; --muted-foreground: #a3a3a3;
    --border: #262626; --input: #262626;
  }
`






export async function downloadPdf(title: string, bodyHtml: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ])

  const isDark = document.documentElement.classList.contains("dark")

  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.top = "0"
  iframe.style.left = "-10000px"
  iframe.style.width = "1024px"
  iframe.style.height = "600px"
  iframe.style.border = "none"
  document.body.appendChild(iframe)

  try {
    await new Promise<void>((resolve, reject) => {
      iframe.onload = () => resolve()
      iframe.onerror = () => reject(new Error("Export iframe failed to load"))
      iframe.srcdoc = "<!doctype html><html><head></head><body></body></html>"
    })

    const iframeDoc = iframe.contentDocument
    if (!iframeDoc) throw new Error("Export iframe has no document")

    for (const node of document.head.querySelectorAll("link[rel='stylesheet'], style")) {
      iframeDoc.head.appendChild(node.cloneNode(true))
    }
    const overrides = iframeDoc.createElement("style")
    overrides.textContent = PDF_THEME_OVERRIDES
    iframeDoc.head.appendChild(overrides)

    if (isDark) iframeDoc.documentElement.classList.add("dark")
    iframeDoc.body.className = "bg-background text-foreground"
    iframeDoc.body.style.margin = "0"
    iframeDoc.body.innerHTML = bodyHtml


    await iframeDoc.fonts?.ready

    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))


    iframe.style.height = `${iframeDoc.documentElement.scrollHeight}px`

    const canvas = await html2canvas(iframeDoc.body, {
      scale: 2,
      backgroundColor: isDark ? "#0a0a0a" : "#ffffff",
      useCORS: true,
    })

    const pdf = new jsPDF({ unit: "pt", format: "a4" })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    const imgData = canvas.toDataURL("image/jpeg", 0.92)



    const [r, g, b] = isDark ? [10, 10, 10] : [255, 255, 255]
    const fillPage = () => {
      pdf.setFillColor(r, g, b)
      pdf.rect(0, 0, pageWidth, pageHeight, "F")
    }



    let heightLeft = imgHeight
    let position = 0
    fillPage()
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    while (heightLeft > 0) {
      position = -(imgHeight - heightLeft)
      pdf.addPage()
      fillPage()
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    pdf.save(`${slugifyFilename(title)}.pdf`)
  } finally {
    iframe.remove()
  }
}
