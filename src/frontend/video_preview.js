class VideoPreview extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    // Set the Shadow DOM content only once
    this.shadowRoot.innerHTML = `
      <img src="" style="width: 100%;" alt=""/>
      <slot></slot>
    `;
    this.videoEl = this.shadowRoot.querySelector("img");
    this.srcUrl = this.getAttribute("src");
    this.refreshInterval = +this.getAttribute("refresh-interval") || 10000;
    this.loading = true;
    this.timer = null;
    this.initialized = false;
  }

  // Observe changes to the 'src' attribute
  static get observedAttributes() {
    return ['src'];
  }

  // Handle attribute changes
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'src') {
      if (newValue !== oldValue) {
        this.srcUrl = newValue;
        this.loading = true; // Reset loading state only if src has changed
        this.refreshVideo();
      }
    }
  }

  connectedCallback() {
    if (!this.initialized) {
      this.initialized = true;
      this.refreshVideo();

      this.timer = setInterval(() => {
        this.refreshVideo();
      }, this.refreshInterval);
    }
  }

  disconnectedCallback() {
    if (this.timer) clearInterval(this.timer);
  }

  async refreshVideo() {
    const src = this.srcUrl;

    if (this.loading) {
      // Set the image source to the loading image if it's not already set
      if (!this.videoEl.src.endsWith('loading_loop.webp')) {
        this.videoEl.src = './loading_loop.webp';
      }

      try {
        // Call your backend API to check if the preview is ready
        const response = await fetch(`/is_preview_ready?url=${encodeURIComponent(src)}`);
        const data = await response.json();

        if (data.ready) {
          this.loading = false;
          // Now that the preview is available, update the image source
          this.refreshVideo(); // Call refreshVideo again to update the image source
        } else {
          // Try again in a sec
          setTimeout(() => this.refreshVideo(), 1000);
        }
      } catch (error) {
        console.error('Error checking preview readiness:', error);
        // Retry after a delay
        setTimeout(() => this.refreshVideo(), 1000);
      }
    } else {
      // Loading is complete, set the image source to the preview URL
      const url = new URL(src);
      url.searchParams.set("t", +new Date());
      const newSrc = url.toString();

      if (newSrc !== this.videoEl.src) {
        this.videoEl.src = newSrc;
      }
    }
  }
}

window.customElements.define("video-preview", VideoPreview);
