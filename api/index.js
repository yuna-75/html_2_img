import { chromium } from 'playwright-core';
import chromiumPath from '@sparticuz/chromium';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let browser = null;
  let context = null;
  let page = null;

  try {
    const { html, width = 800, height = 600 } = await req.json();

    if (!html) {
      return new Response('缺少 HTML 内容', { status: 400 });
    }

    if (typeof html !== 'string' || html.trim() === '') {
      return new Response('HTML 内容无效', { status: 400 });
    }

    browser = await chromium.launch({
      headless: true,
      executablePath: await chromiumPath.executablePath,
      args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
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
      return new Response('生成的截图为空或损坏', { status: 500 });
    }

    console.log('生成的截图长度:', screenshot.length);

    await context.close();

    return new Response(screenshot, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache',
        'Content-Disposition': 'attachment; filename="screenshot.png"'
      }
    });
  } catch (error) {
    console.error('详细错误信息:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return new Response('服务器内部错误', { status: 500 });
  } finally {
    if (page) await page.close().catch(console.error);
    if (context) await context.close().catch(console.error);
    if (browser) await browser.close().catch(console.error);
  }
}