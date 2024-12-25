const { chromium } = require('playwright');
const express = require('express');

const app = express();
app.use(express.json({ limit: '50mb' }));

// 添加 CORS 头信息
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

let browserInstance = null;

async function initBrowser() {
  if (browserInstance) return browserInstance;
  
  browserInstance = await chromium.launch({
    headless: true
  });
  
  return browserInstance;
}

app.post('/convert', async (req, res) => {
  let browser = null;
  let context = null;
  let page = null;

  try {
    const { html, width = 800, height = 600 } = req.body;

    if (!html) {
      return res.status(400).json({ error: '缺少 HTML 内容' });
    }

    if (typeof html !== 'string' || html.trim() === '') {
      return res.status(400).json({ error: 'HTML 内容无效' });
    }

    browser = await chromium.launch({
      headless: true
    });

    context = await browser.newContext({
      viewport: { 
        width: Math.min(parseInt(width, 10), 1920),
        height: Math.min(parseInt(height, 10), 1080)
      }
    });

    page = await context.newPage();
    
    const wrappedHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: white; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `;

    await page.setContent(wrappedHtml, { 
      waitUntil: 'networkidle',
      timeout: 5000 
    });

    const screenshot = await page.screenshot({ 
      type: 'png'
    });

    if (!screenshot || screenshot.length === 0) {
      console.error('生成的截图为空或损坏');
      return res.status(500).json({ error: '生成的截图为空或损坏' });
    }

    console.log('生成的截图长度:', screenshot.length);

    await context.close();

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-cache');
    res.set('Content-Disposition', 'attachment; filename="screenshot.png"');
    res.send(screenshot);
  } catch (error) {
    console.error('详细错误信息:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({ 
      error: '服务器内部错误',
      details: error.message
    });
  } finally {
    if (page) await page.close().catch(console.error);
    if (context) await context.close().catch(console.error);
    if (browser) await browser.close().catch(console.error);
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
}); 