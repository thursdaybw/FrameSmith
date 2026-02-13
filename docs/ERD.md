Uncle Bob here.

You want an **Entity Relationship Diagram** (ERD) for the *current*, not future, system — meaning:

* **Current caption model**
* **Current style preset system**
* **Current renderer / layout / script interactions**
* **NOT the future RenderPlan, NOT podcast timeline yet**

This ERD captures exactly what exists today in your codebase.

---

# ✅ **Framesmith (Current System) — Entity Relationship Diagram**

```
+---------------------+
|     CaptionSegment  |
+---------------------+
| start: number       |
| end: number         |
| text: string        |
| words: Word[]       |
| override?: Override |
+---------------------+
            |
            | has many
            v
+---------------------+
|        Word         |
+---------------------+
| start: number       |
| end: number         |
| text: string        |
| override?: Override |
+---------------------+

+--------------------------+
|        Override          |
+--------------------------+
| styleName: string        |
| params?: object          |
+--------------------------+
        ^
        | optional reference
        |
+--------------------------+
|      StylePreset         |
+--------------------------+
| name: string             |
| fontSize: number         |
| fontFamily: string       |
| fill: string             |
| stroke: string           |
| highlightFill: string    |
| maxWidthMultiplier: num  |
| verticalOffset: number   |
| lineHeightMultiplier:num |
| animateHighlight?: fn    |
+--------------------------+


+--------------------------+
|      CaptionModel.js     |
+--------------------------+
| whisperToCaptionSegments |
+--------------------------+
            |
            | produces CaptionSegment[]
            v
+--------------------------+
|      captionRenderer     |
+--------------------------+
| drawCaptionForTime()     |
+--------------------------+
            |
            | uses
            v
+--------------------------+
|        layout.js         |
+--------------------------+
| wrapLine()               |
+--------------------------+


+--------------------------+
|      stylePreset.js      |
+--------------------------+
| getStyle()               |
| preset definitions       |
+--------------------------+


+--------------------------+
|        script.js         |
+--------------------------+
| main loop                |
| draw frame               |
| call captionRenderer     |
+--------------------------+
            |
            | uses HTML
            v
+--------------------------+
|       index.html         |
+--------------------------+
| <video> <canvas> etc     |
+--------------------------+

```

---

# 🔍 **Explanation of Relationships**

### **CaptionSegment → Word**

* **One-to-many**
* A segment retains:

  * timing window
  * full text
  * word-level timing
* Currently the renderer expects one active segment per timestamp.

### **Segment/Word → Override**

* **Optional**
* Allows:

  * per-segment style variations
  * per-word highlight animations
  * param overrides (e.g., `{ pulseSpeed: 2 }`)

### **Override → StylePreset**

* Override *refers to* a style by name.
* Renderer merges:

  * preset defaults
  * override params
  * global animation transforms

### **captionRenderer → stylePreset**

* Renderer requests a preset via:
  `getStyle(name)`

### **captionRenderer → layout**

* Renderer uses layout:
  `wrapLine(ctx, text, maxWidth)`

### **script.js → renderer**

* Script drives:

  * playback loop
  * canvas draw
  * `drawCaptionForTime(currentTime)`

### **index.html**

* Provides:

  * video element
  * canvas
  * run button

---

# 🔥 If you want, I can produce:

* A UML class diagram
* A Mermaid.js diagram
* A layered architecture diagram
* A dependency graph
* A data-flow pipeline diagram (time t → frame compositing)

Which form do you want next?

