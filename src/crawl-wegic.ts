import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as cheerio from 'cheerio';

// Define the base URLs and paths to crawl
const helpBaseUrl = 'https://help.wegic.ai';
const blogBaseUrl = 'https://wegic.ai';

// Documentation paths
const docPaths = [
  '/whats-wegic',
  '/start-build-your-website/beginners-guide',
  '/start-build-your-website/navigate-the-interface',
  '/start-edit-manually/edit-pages',
  '/start-edit-manually/modify-site-header',
  '/start-edit-manually/change-fonts-and-theme',
  '/start-edit-manually/edit-text-and-links',
  '/start-edit-manually/replace-images-and-icons',
  '/start-edit-manually/modify-the-footer',
  '/chat-with-ai-to-edit/commonly-used-prompts',
  '/chat-with-ai-to-edit/modify-style-and-layout',
  '/chat-with-ai-to-edit/add-web-animations',
  '/section-circling-drawing/mark-section-with-drawing',
  '/section-circling-drawing/draw-reference-sketch',
  '/section-circling-drawing/upload-reference-image',
  '/embed-media-and-third-party-tools/add-video-and-audio',
  '/embed-media-and-third-party-tools/forms-and-booking',
  '/embed-media-and-third-party-tools/embed-other-tools',
  '/publish-and-management/publish-your-website',
  '/publish-and-management/custom-domain',
  '/publish-and-management/update-and-unpublish',
  '/publish-and-management/website-settings',
  '/publish-and-management/account-management',
  '/seo-marketing/custom-head-code',
  '/seo-marketing/add-google-analytics',
  '/seo-marketing/get-embed-codes-for-google-tools',
  '/manage-your-wegic-plan/upgrade-your-wegic-plan',
  '/manage-your-wegic-plan/subscription-and-payment-faq',
  '/content-auto-sync/create-content-auto-sync',
  '/content-auto-sync/errors-and-solutions',
  '/faqs'
];

interface PageContent {
  path: string;
  title: string;
  content: string;
  url: string;
  type: 'doc' | 'blog';
}

function extractTextContent(html: string): { title: string; content: string } {
  // Remove script tags and their content
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove style tags and their content
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Extract title from meta tags or h1
  let title = '';
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
                    html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                    html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  // Remove all HTML tags but preserve line breaks for readability
  let content = html
    .replace(/<\/(div|p|h[1-6]|section|article|main|header|footer)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

  // Remove any remaining HTML entities
  content = content.replace(/&[^;]+;/g, '');

  return { title, content };
}

async function crawlPage(path: string, type: 'doc' | 'blog'): Promise<PageContent> {
  const baseUrl = type === 'doc' ? helpBaseUrl : blogBaseUrl;
  const url = `${baseUrl}${path}`;
  console.log(`Crawling ${url}...`);
  
  try {
    const response = await axios.get(url);
    const html = response.data;
    
    // Extract clean text content
    const { title, content } = extractTextContent(html);
    
    // Use path as fallback title if none found
    const finalTitle = title || path.split('/').pop() || 'Untitled';
    
    return {
      path,
      title: finalTitle,
      content,
      url,
      type
    };
  } catch (error) {
    console.error(`Error crawling ${url}:`, error);
    throw error;
  }
}

async function extractBlogPaths(): Promise<string[]> {
  try {
    const response = await axios.get(`${blogBaseUrl}/blog`);
    const $ = cheerio.load(response.data);
    const blogPaths = new Set<string>();

    // Find all links that start with /blog/
    $('a').each((_, element) => {
      const href = $(element).attr('href');
      if (href?.startsWith('/blog/')) {
        blogPaths.add(href);
      }
    });

    return Array.from(blogPaths);
  } catch (error) {
    console.error('Error extracting blog paths:', error);
    return [];
  }
}

async function saveContent(content: PageContent) {
  const baseDir = content.type === 'doc' ? 'wegic-docs' : 'wegic-blog';
  const contentDir = path.join(process.cwd(), baseDir);
  
  // Create content directory if it doesn't exist
  await fs.mkdir(contentDir, { recursive: true });
  
  // Create a sanitized filename
  const filename = content.path
    .replace(/^\//, '')
    .replace(/\//g, '--')
    .replace(/[^a-zA-Z0-9--]/g, '-')
    + '.json';
    
  const filepath = path.join(contentDir, filename);
  
  // Save the content as JSON
  await fs.writeFile(
    filepath,
    JSON.stringify(content, null, 2),
    'utf-8'
  );
  
  console.log(`Saved ${filepath}`);
}

async function main() {
  try {
    // Get blog paths
    console.log('Extracting blog paths...');
    const blogPaths = await extractBlogPaths();
    console.log(`Found ${blogPaths.length} blog posts`);

    // Create arrays of promises for both docs and blog posts
    const docPromises = docPaths.map(path => 
      crawlPage(path, 'doc')
        .then(content => saveContent(content))
        .catch(error => console.error(`Failed to process doc ${path}:`, error))
    );
    
    const blogPromises = blogPaths.map(path => 
      crawlPage(path, 'blog')
        .then(content => saveContent(content))
        .catch(error => console.error(`Failed to process blog ${path}:`, error))
    );
    
    // Wait for all crawls to complete
    await Promise.all([...docPromises, ...blogPromises]);
    
    console.log('Crawling completed!');
  } catch (error) {
    console.error('Crawling failed:', error);
  }
}

main().catch(console.error); 