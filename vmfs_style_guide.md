
# Vijay Malik Financial Services — Premium Design Style Guide
*(Royal Blue & Gold Theme - Billion Dollar Aesthetic)*

> Based on premium financial services branding with royal blue & champagne gold palette  
> Brand positioning: Professional, Trustworthy, Premium, Sophisticated

---

## 🎨 Premium Color System

### Primary Brand Colors
- **Navy Deep (Primary)**  
  - Default: `#1B365D` (`--color-brand-navy`)  
  - Usage: headers, primary buttons, navigation, main text on light backgrounds  
  - Psychology: Trust, stability, authority, professionalism

- **Royal Blue (Secondary)**  
  - Default: `#2E5984` (`--color-brand-royal`)  
  - Usage: secondary buttons, links, accents, hover states  
  - Psychology: Reliability, confidence, intelligence

- **Champagne Gold (Accent)**  
  - Default: `#C5A572` (`--color-brand-gold`)  
  - Usage: premium highlights, CTAs, success states, active nav  
  - Psychology: Premium quality, success, sophistication

### Supporting Colors
- **Pearl White**: `#F8F9FA` (`--color-brand-pearl`) - Primary backgrounds, cards
- **Cloud Gray**: `#6C757D` (`--color-brand-cloud`) - Body text, secondary content  
- **Platinum**: `#E9ECEF` (`--color-brand-platinum`) - Borders, dividers, input backgrounds
- **Soft Blue**: `#8B9DC3` (`--color-brand-soft-blue`) - Subtle accents, disabled states

### Premium Gradients
- **Navy → Royal**: `linear-gradient(135deg, #1B365D 0%, #2E5984 100%)`
- **Gold Gradient**: `linear-gradient(135deg, #C5A572 0%, #D4AF37 100%)`
- **Hero Overlay**: `linear-gradient(135deg, rgba(27,54,93,0.9) 0%, rgba(46,89,132,0.8) 100%)`
- **Pearl Background**: `linear-gradient(to bottom, #FFFFFF, #F8F9FA)`  

---

## ✍️ Typography

### Font Family
- **Inter** (primary sans-serif)  
  - `--font-family-sans`, `--font-family-display`  

### Font Weights
- Normal: 400  
- Medium: 500  
- Semibold: 600  
- Bold: 700  
- ExtraBold: 800  

### Font Sizes
- XS: 12px (`0.75rem`)  
- SM: 14px (`0.875rem`)  
- Base: 16px (`1rem`)  
- LG: 18px (`1.125rem`)  
- XL: 20px (`1.25rem`)  
- 2XL: 24px (`1.5rem`)  
- 3XL: 30px (`1.875rem`)  
- 4XL: 36px (`2.25rem`)  
- 5XL: 48px (`3rem`)  
- 6XL: 60px (`3.75rem`)  
- 7XL: 72px (`4.5rem`)  

### Usage Recommendations
- **Headings (h1–h3):** Navy Deep or Royal Blue, Bold/ExtraBold (600–800), size 3XL–6XL  
- **Subheadings (h4–h6):** Royal Blue, Semibold, size LG–2XL  
- **Body text:** Cloud Gray, Normal/Medium, size Base–LG  
- **Buttons & Nav links:** Navy/Gold, Bold, size Base–LG  
- **Premium elements:** Champagne Gold accents sparingly for impact

---

## 🧩 Premium Component Styling

### Navigation Links
- Base: `text-base md:text-lg font-bold transition-colors`  
- Inactive: Navy text → hover Gold  
- Active: Gold text bold  

### Buttons
- **Primary:** Navy background, white text, hover royal blue  
  ```css
  px-6 py-2.5 rounded-full bg-brand-navy text-white font-semibold shadow-md hover:bg-brand-royal
  ```
- **Secondary:** White background, navy border/text  
  ```css
  px-6 py-2.5 rounded-full bg-white/90 border-2 border-brand-navy text-brand-navy font-semibold hover:bg-brand-pearl
  ```
- **Premium (Gold):** Gold background, navy text  
  ```css
  px-6 py-2.5 rounded-full bg-brand-gold text-brand-navy font-bold shadow-md hover:shadow-lg
  ```

### Cards
- **Light:** White background, platinum border, rounded-2xl, shadow-lg  
- **Premium:** Navy → Royal gradient, white text, rounded-2xl, shadow-lg  
- **Gold Accent:** Gold gradient background for special promotions

### Headings
- Color: Navy (`text-brand-navy`) on light, White on dark sections  
- Premium: Gold accent underlines for special emphasis  
- Alignment: left/center/right, with smooth animations  

### Sections
- **Light:** Pearl white background, navy text  
- **Premium:** Navy → Royal gradient background, white text  
- **Accent:** Soft blue background for highlighted content  

---

## ✨ Animations

Predefined **Framer Motion** variants:

- **fadeIn**  
  ```js
  initial: { opacity: 0 }
  animate: { opacity: 1 }
  transition: { duration: 0.4 }
  ```

- **slideIn**  
  ```js
  initial: { opacity: 0, y: 20 }
  animate: { opacity: 1, y: 0 }
  transition: { duration: 0.4 }
  ```

- **stagger (container + item)**  
  ```js
  container: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { staggerChildren: 0.1 } }
  },
  item: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  }
  ```

- **Text Shadows** (for overlays)  
  - Light: `0 1px 2px rgba(0,0,0,0.3)`  
  - Medium: `0 2px 4px rgba(0,0,0,0.5)`  
  - Heavy: `0 3px 6px rgba(0,0,0,0.7)`  

---

## ✅ Best Practices
1. Always use **theme tokens** (`--color-olive`, `getColor('navy')`, etc.) instead of hardcoded values.  
2. Headings should maintain strong hierarchy (3XL–6XL) with Olive/White emphasis.  
3. Keep button shapes consistent (rounded-full) for a premium look.  
4. Use subtle animations (`fadeIn`, `slideIn`) for sections, cards, and CTA entries.  
5. Maintain **contrast ratios** for accessibility (e.g., white text on olive/navy).  

---

This guide ensures your website remains **consistent, professional, and scalable** — reflecting the premium positioning of your financial services brand.
