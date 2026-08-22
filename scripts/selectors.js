// ============================================================================
// selectors.js - Centralized DOM Selectors and UI Matchers for Gemini Web
// ============================================================================

module.exports = {
  // Input area and rich text editor
  input: {
    editor: 'div.ql-editor, rich-textarea, textarea, [contenteditable="true"]',
    container: 'input-area, .chat-input-container, rich-textarea, input-container',
  },

  // Upload '+' button and popup menu
  upload: {
    buttonAriaMatches: ['上传', 'upload', 'tools', '上传和工具', 'attach', 'add file'],
    menuItemTexts: [
      '上传文件',
      '上传图片',
      'upload files',
      'upload image',
      'upload file',
      'add image'
    ],
    menuContainer: '.cdk-overlay-container, [role="menu"], .mat-mdc-menu-panel',
    menuItems: 'button, div[role="menuitem"], .mat-mdc-menu-item, span',
  },

  // UI state control buttons
  buttons: {
    closeAriaMatches: ['关闭对话框', '关闭弹窗', 'close dialog', 'dismiss dialog', 'dismiss popup'],
    stopAriaMatches: ['停止', 'stop', 'cancel', '停止响应', 'stop response'],
    sendAriaMatches: ['发送', 'send', 'submit', '发送提示', 'send message'],
  },

  // Image attachment cards in input box (Gate 1)
  attachment: {
    chips: [
      '.gem-attachment-style-img',
      '.input-area img',
      '.chat-input-container img',
      'rich-textarea img',
      '.attachment-preview',
      '.uploaded-image',
      '[data-test-id*="attachment"]',
      'img[src*="blob:"]',
      '.file-preview-card',
      'button[aria-label*="关闭附件"]'
    ],
  },

  // User chat query bubble (Gate 2)
  chat: {
    userQueryBubbles: [
      '.user-query-container',
      'user-query',
      '[data-test-id="user-query"]',
      '.query-container'
    ],
    userQueryImages: 'img',
  },

  // Generated images in conversation
  output: {
    generatedImages: [
      'generated-image img',
      'single-image img',
      '.image-container img',
      'img.image',
      'div.response-content img',
      'model-response img'
    ],
    minWidth: 250,
    minHeight: 250,
  },

  // Error & refusal sniffer patterns (Fast-Fail)
  refusals: {
    toastOrBannerSelectors: [
      'notification-banner',
      '.error-message',
      '.toast',
      'mat-snack-bar-container',
      '.system-message',
      'div[role="alert"]'
    ],
    keywords: [
      '无法生成图片',
      '无法为您生成',
      '政策限制',
      '不能生成',
      '违反对安全',
      '违反政策',
      "i can't generate",
      "i cannot generate",
      "unable to generate",
      "safety policy",
      "content policy",
      "try a different prompt",
      "that violates",
      "sorry, i can't create"
    ]
  }
};
