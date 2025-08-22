# Deep Linking Story 2: Dynamic Page Content Creation

## Story Overview

As an instructor, I want to create and embed custom HTML pages and interactive content from the Atomic Guide tool so that I can provide rich, formatted learning materials directly within my course without external hosting.

## Actors

- **Instructor**: Content creator adding materials to course
- **Student**: End user who will view the embedded content
- **LMS Platform**: System displaying the embedded content
- **Atomic Guide Tool**: Provider of content creation interface

## Preconditions

1. Instructor has completed initial deep linking launch
2. Platform accepts 'html' content type in deep linking settings
3. Tool has detected HTML support in `accept_types` array

## Main Flow

### 1. Content Creation Mode Selection

**Actor:** Instructor
**Context:** Tool has detected `accept_types.includes('html')`
**UI Display:**

```javascript
if (launchSettings.deepLinking.accept_types.indexOf('html') >= 0) {
  // Show HTML content creation interface
}
```

### 2. HTML Content Editor Interface

**Actor:** Tool
**Action:** Displays rich content editor
**Features Provided:**

- Rich text editor with formatting toolbar
- HTML source code view toggle
- Preview pane showing rendered content
- Template selection dropdown
- Media embedding capabilities

### 3. Content Types Available

#### Type A: Simple Formatted Text

**Use Case:** Quick announcements or instructions

```html
<div class="announcement">
  <h2>Week 3 Update</h2>
  <p>Please complete the following before our next class:</p>
  <ul>
    <li>Read Chapter 5</li>
    <li>Submit reflection paper</li>
    <li>Review lecture slides</li>
  </ul>
</div>
```

#### Type B: Interactive Learning Module

**Use Case:** Self-paced learning content

```html
<div class="learning-module">
  <h1>Introduction to Data Structures</h1>

  <section class="concept">
    <h2>What is an Array?</h2>
    <p>An array is a collection of elements...</p>

    <div class="interactive-demo">
      <canvas id="array-viz"></canvas>
      <button onclick="animateInsertion()">Show Insert</button>
      <button onclick="animateDeletion()">Show Delete</button>
    </div>
  </section>

  <section class="practice">
    <h3>Try it yourself:</h3>
    <pre><code>const myArray = [1, 2, 3, 4, 5];</code></pre>
  </section>
</div>
```

#### Type C: Embedded Media Gallery

**Use Case:** Visual learning materials

```html
<div class="media-gallery">
  <h2>Historical Artifacts</h2>

  <div class="gallery-grid">
    <figure>
      <img src="data:image/jpeg;base64,..." alt="Artifact 1" />
      <figcaption>Ancient pottery, 500 BCE</figcaption>
    </figure>

    <figure>
      <video controls>
        <source src="data:video/mp4;base64,..." type="video/mp4" />
      </video>
      <figcaption>Restoration process</figcaption>
    </figure>
  </div>
</div>
```

### 4. Content Styling Options

**Actor:** Instructor
**Action:** Applies styling to content
**Available Styles:**

```css
/* Tool provides these pre-defined styles */
.content-wrapper {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.highlight-box {
  background: #f0f8ff;
  border-left: 4px solid #0066cc;
  padding: 15px;
  margin: 20px 0;
}

.interactive-element {
  background: #ffffff;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
```

### 5. Content Validation

**System Process:**

1. Sanitize HTML to prevent XSS attacks
2. Validate that content doesn't exceed size limits
3. Ensure no external scripts that could break iframe sandbox
4. Check for accessibility compliance (alt texts, semantic HTML)

### 6. Preview and Testing

**Actor:** Instructor
**Action:** Reviews content in preview mode
**Preview Features:**

- Responsive view (mobile, tablet, desktop)
- Dark mode compatibility check
- Accessibility audit results
- Estimated load time

### 7. Metadata Configuration

**Actor:** Instructor
**Action:** Sets content properties
**Required Fields:**

```javascript
{
  type: 'html',
  html: '<validated-content>',
  title: 'Module 3: Data Structures',  // Display title
  text: 'Introduction to arrays and lists',  // Description
  // Optional metadata
  custom: {
    estimated_time: '15 minutes',
    difficulty: 'beginner',
    prerequisites: ['Module 1', 'Module 2']
  }
}
```

### 8. Content Packaging

**System Process:**

1. Minify HTML while preserving functionality
2. Inline critical CSS for faster rendering
3. Convert images to base64 if under size threshold
4. Generate content hash for versioning

### 9. Deep Link Response Creation

**System Process:**

```javascript
// Client prepares the content item
const deepLink = {
  type: 'html',
  html: processedHtmlContent,
  title: metadata.title,
  text: metadata.description,
  custom: metadata.custom,
};

// Send to server for signing
fetch('/lti/sign_deep_link', {
  method: 'POST',
  body: JSON.stringify([deepLink]),
  headers: {
    Authorization: `Bearer ${jwt}`,
    'Content-Type': 'application/json',
  },
});
```

### 10. Platform Storage

**Actor:** LMS Platform
**Process:**

1. Receives signed deep link response
2. Extracts HTML content from JWT payload
3. Stores content in platform database
4. Associates with course and module location

## Student View Flow

### 1. Content Access

**Actor:** Student
**Action:** Navigates to course module with embedded content
**System Response:** Platform renders HTML in sandboxed iframe

### 2. Content Display

**Platform Rendering:**

```html
<iframe src="about:blank" srcdoc="<stored-html-content>" sandbox="allow-same-origin allow-scripts" style="width: 100%; border: none;">
</iframe>
```

### 3. Interaction Handling

**Available Interactions:**

- Click events on buttons and links
- Form submissions (if included)
- Media playback controls
- Expand/collapse sections
- Print-friendly view

## Security Considerations

### Content Sanitization

```javascript
// Server-side sanitization before signing
function sanitizeHtml(html) {
  // Remove dangerous elements
  const forbidden = ['script', 'iframe', 'object', 'embed'];

  // Remove event handlers
  const eventPattern = /on\w+\s*=/gi;

  // Validate URLs in href and src
  const urlPattern = /^(https?:|data:|#)/i;

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'img', 'video', 'audio'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'id', 'controls'],
  });
}
```

### Size Limitations

- Maximum HTML content size: 1MB
- Maximum embedded media: 5MB per item
- Total deep link response: 10MB

### Platform Sandbox

- Content runs in iframe sandbox
- No access to parent window
- No external resource loading
- Limited JavaScript execution

## Alternative Flows

### A1: Content Too Large

**Condition:** HTML content exceeds size limit
**Action:**

1. Tool displays warning message
2. Offers to compress images
3. Suggests splitting into multiple items

### A2: Unsupported HTML Elements

**Condition:** Instructor uses forbidden HTML tags
**Action:**

1. Sanitizer removes dangerous elements
2. Tool shows diff of changes
3. Instructor can accept or modify

### A3: Platform Rejects Content

**Condition:** Platform has additional restrictions
**Response:**

1. Platform returns error in deep link callback
2. Tool displays platform's error message
3. Provides troubleshooting suggestions

## Success Metrics

1. HTML content renders correctly in all major browsers
2. Content is accessible (WCAG 2.1 AA compliant)
3. Page load time under 3 seconds
4. No JavaScript errors in console
5. Content responsive on all device sizes

## Technical Implementation

### Client-Side Content Builder

```javascript
class HtmlContentBuilder {
  constructor(acceptTypes) {
    this.supportedTypes = acceptTypes;
    this.editor = null;
  }

  initEditor() {
    // Initialize rich text editor
    this.editor = new QuillEditor({
      theme: 'snow',
      modules: {
        toolbar: [['bold', 'italic', 'underline'], ['link', 'image', 'video'], [{ list: 'ordered' }, { list: 'bullet' }], ['clean']],
      },
    });
  }

  getContent() {
    const html = this.editor.getHTML();
    return this.sanitizeContent(html);
  }

  createDeepLink() {
    return {
      type: 'html',
      html: this.getContent(),
      title: this.getTitle(),
      text: this.getDescription(),
    };
  }
}
```

### Server-Side Processing

```typescript
async function processHtmlContent(content: string): Promise<string> {
  // Sanitize
  const clean = sanitizeHtml(content);

  // Optimize
  const optimized = await minifyHtml(clean);

  // Validate
  if (optimized.length > MAX_CONTENT_SIZE) {
    throw new Error('Content exceeds maximum size');
  }

  return optimized;
}
```

## Related Stories

- Story 1: Initial deep linking selection flow
- Story 3: Assessment configuration via deep linking
- Platform-specific HTML content guidelines
- Accessibility requirements for embedded content
