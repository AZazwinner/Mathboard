export type MathSymbol = {
    // what you type after "/" - e.g. "sigma" for \sigma
    trigger: string
    // the LaTeX command, shown as the menu's subtitle so the entry stays
    // readable even when `template` below is a whole snippet
    latex: string
    // preview glyph shown in the menu - the literal character KaTeX renders,
    // or (for upright operators like \sin, \lim) the word itself
    glyph: string
    // extra consumer-friendly search terms - e.g. "infinity" for \infty,
    // so people don't have to already know the LaTeX name
    aliases?: string[]
    // CodeMirror snippet body with tab stops (${1:default}, ${0} final stop); falls back to `latex` when omitted.
    template?: string
}

// A curated subset of KaTeX's symbol set, cross-checked against katex/src/{symbols,macros}.ts.
export const MATH_SYMBOLS: MathSymbol[] = [
    // ---- Greek (lowercase) ----
    { trigger: "alpha", latex: "\\alpha", glyph: "α" },
    { trigger: "beta", latex: "\\beta", glyph: "β" },
    { trigger: "gamma", latex: "\\gamma", glyph: "γ" },
    { trigger: "delta", latex: "\\delta", glyph: "δ" },
    { trigger: "epsilon", latex: "\\epsilon", glyph: "ϵ" },
    { trigger: "varepsilon", latex: "\\varepsilon", glyph: "ε" },
    { trigger: "zeta", latex: "\\zeta", glyph: "ζ" },
    { trigger: "eta", latex: "\\eta", glyph: "η" },
    { trigger: "theta", latex: "\\theta", glyph: "θ" },
    { trigger: "vartheta", latex: "\\vartheta", glyph: "ϑ" },
    { trigger: "iota", latex: "\\iota", glyph: "ι" },
    { trigger: "kappa", latex: "\\kappa", glyph: "κ" },
    { trigger: "lambda", latex: "\\lambda", glyph: "λ" },
    { trigger: "mu", latex: "\\mu", glyph: "μ" },
    { trigger: "nu", latex: "\\nu", glyph: "ν" },
    { trigger: "xi", latex: "\\xi", glyph: "ξ" },
    { trigger: "omicron", latex: "\\omicron", glyph: "ο" },
    { trigger: "pi", latex: "\\pi", glyph: "π" },
    { trigger: "varpi", latex: "\\varpi", glyph: "ϖ" },
    { trigger: "rho", latex: "\\rho", glyph: "ρ" },
    { trigger: "varrho", latex: "\\varrho", glyph: "ϱ" },
    { trigger: "sigma", latex: "\\sigma", glyph: "σ" },
    { trigger: "varsigma", latex: "\\varsigma", glyph: "ς" },
    { trigger: "tau", latex: "\\tau", glyph: "τ" },
    { trigger: "upsilon", latex: "\\upsilon", glyph: "υ" },
    { trigger: "phi", latex: "\\phi", glyph: "ϕ" },
    { trigger: "varphi", latex: "\\varphi", glyph: "φ" },
    { trigger: "chi", latex: "\\chi", glyph: "χ" },
    { trigger: "psi", latex: "\\psi", glyph: "ψ" },
    { trigger: "omega", latex: "\\omega", glyph: "ω" },

    // ---- Greek (uppercase - only the ones visually distinct from Latin) ----
    { trigger: "Gamma", latex: "\\Gamma", glyph: "Γ" },
    { trigger: "Delta", latex: "\\Delta", glyph: "Δ" },
    { trigger: "Theta", latex: "\\Theta", glyph: "Θ" },
    { trigger: "Lambda", latex: "\\Lambda", glyph: "Λ" },
    { trigger: "Xi", latex: "\\Xi", glyph: "Ξ" },
    { trigger: "Pi", latex: "\\Pi", glyph: "Π" },
    { trigger: "Sigma", latex: "\\Sigma", glyph: "Σ" },
    { trigger: "Upsilon", latex: "\\Upsilon", glyph: "Υ" },
    { trigger: "Phi", latex: "\\Phi", glyph: "Φ" },
    { trigger: "Psi", latex: "\\Psi", glyph: "Ψ" },
    { trigger: "Omega", latex: "\\Omega", glyph: "Ω" },

    // ---- Big operators & calculus ----
    {
        trigger: "sum",
        latex: "\\sum",
        glyph: "∑",
        aliases: ["summation"],
        template: "\\sum_{${1:i=1}}^{${2:n}}",
    },
    {
        trigger: "prod",
        latex: "\\prod",
        glyph: "∏",
        aliases: ["product"],
        template: "\\prod_{${1:i=1}}^{${2:n}}",
    },
    {
        trigger: "coprod",
        latex: "\\coprod",
        glyph: "∐",
        template: "\\coprod_{${1:i=1}}^{${2:n}}",
    },
    {
        trigger: "int",
        latex: "\\int",
        glyph: "∫",
        aliases: ["integral"],
        template: "\\int_{${1:a}}^{${2:b}}",
    },
    { trigger: "iint", latex: "\\iint", glyph: "∬", template: "\\iint_{${1:D}}" },
    { trigger: "iiint", latex: "\\iiint", glyph: "∭", template: "\\iiint_{${1:V}}" },
    { trigger: "oint", latex: "\\oint", glyph: "∮", template: "\\oint_{${1:C}}" },
    { trigger: "infty", latex: "\\infty", glyph: "∞", aliases: ["infinity"] },
    { trigger: "partial", latex: "\\partial", glyph: "∂", aliases: ["derivative"] },
    { trigger: "nabla", latex: "\\nabla", glyph: "∇", aliases: ["gradient", "del"] },
    {
        trigger: "sqrt",
        latex: "\\sqrt{}",
        glyph: "√",
        aliases: ["root", "squareroot"],
        template: "\\sqrt{${1}}",
    },
    {
        trigger: "lim",
        latex: "\\lim",
        glyph: "lim",
        template: "\\lim_{${1:x} \\to ${2:\\infty}}",
    },
    { trigger: "sin", latex: "\\sin", glyph: "sin" },
    { trigger: "cos", latex: "\\cos", glyph: "cos" },
    { trigger: "tan", latex: "\\tan", glyph: "tan" },
    { trigger: "log", latex: "\\log", glyph: "log" },
    { trigger: "ln", latex: "\\ln", glyph: "ln" },
    { trigger: "exp", latex: "\\exp", glyph: "exp" },
    { trigger: "det", latex: "\\det", glyph: "det" },
    { trigger: "gcd", latex: "\\gcd", glyph: "gcd" },
    { trigger: "max", latex: "\\max", glyph: "max" },
    { trigger: "min", latex: "\\min", glyph: "min" },
    { trigger: "sup", latex: "\\sup", glyph: "sup" },
    { trigger: "inf", latex: "\\inf", glyph: "inf" },

    // ---- Relations ----
    { trigger: "leq", latex: "\\leq", glyph: "≤", aliases: ["le", "lessthanorequal"] },
    { trigger: "geq", latex: "\\geq", glyph: "≥", aliases: ["ge", "greaterthanorequal"] },
    { trigger: "neq", latex: "\\neq", glyph: "≠", aliases: ["ne", "notequal"] },
    { trigger: "approx", latex: "\\approx", glyph: "≈", aliases: ["approximately"] },
    { trigger: "equiv", latex: "\\equiv", glyph: "≡", aliases: ["equivalent"] },
    { trigger: "sim", latex: "\\sim", glyph: "∼" },
    { trigger: "simeq", latex: "\\simeq", glyph: "≃" },
    { trigger: "cong", latex: "\\cong", glyph: "≅", aliases: ["congruent"] },
    { trigger: "propto", latex: "\\propto", glyph: "∝", aliases: ["proportional"] },
    { trigger: "in", latex: "\\in", glyph: "∈", aliases: ["element", "belongsto"] },
    { trigger: "notin", latex: "\\notin", glyph: "∉", aliases: ["notelement"] },
    { trigger: "ni", latex: "\\ni", glyph: "∋" },
    { trigger: "subset", latex: "\\subset", glyph: "⊂" },
    { trigger: "supset", latex: "\\supset", glyph: "⊃" },
    { trigger: "subseteq", latex: "\\subseteq", glyph: "⊆" },
    { trigger: "supseteq", latex: "\\supseteq", glyph: "⊇" },

    // ---- Set theory & logic ----
    { trigger: "cup", latex: "\\cup", glyph: "∪", aliases: ["union"] },
    { trigger: "cap", latex: "\\cap", glyph: "∩", aliases: ["intersect", "intersection"] },
    { trigger: "setminus", latex: "\\setminus", glyph: "∖" },
    { trigger: "emptyset", latex: "\\emptyset", glyph: "∅", aliases: ["empty"] },
    { trigger: "varnothing", latex: "\\varnothing", glyph: "∅" },
    { trigger: "forall", latex: "\\forall", glyph: "∀", aliases: ["all", "forevery"] },
    { trigger: "exists", latex: "\\exists", glyph: "∃", aliases: ["thereexists"] },
    { trigger: "nexists", latex: "\\nexists", glyph: "∄" },
    { trigger: "neg", latex: "\\neg", glyph: "¬", aliases: ["not"] },
    { trigger: "wedge", latex: "\\wedge", glyph: "∧", aliases: ["and"] },
    { trigger: "vee", latex: "\\vee", glyph: "∨", aliases: ["or"] },
    { trigger: "therefore", latex: "\\therefore", glyph: "∴" },
    { trigger: "because", latex: "\\because", glyph: "∵" },

    // ---- Arithmetic & binary operators ----
    { trigger: "pm", latex: "\\pm", glyph: "±", aliases: ["plusminus"] },
    { trigger: "mp", latex: "\\mp", glyph: "∓", aliases: ["minusplus"] },
    { trigger: "times", latex: "\\times", glyph: "×", aliases: ["multiply", "cross"] },
    { trigger: "div", latex: "\\div", glyph: "÷", aliases: ["divide"] },
    { trigger: "cdot", latex: "\\cdot", glyph: "⋅", aliases: ["dot"] },
    { trigger: "ast", latex: "\\ast", glyph: "∗" },
    { trigger: "circ", latex: "\\circ", glyph: "∘" },
    { trigger: "bullet", latex: "\\bullet", glyph: "∙" },
    { trigger: "oplus", latex: "\\oplus", glyph: "⊕" },
    { trigger: "otimes", latex: "\\otimes", glyph: "⊗" },

    // ---- Arrows ----
    { trigger: "to", latex: "\\to", glyph: "→", aliases: ["rightarrow", "arrow"] },
    { trigger: "leftarrow", latex: "\\leftarrow", glyph: "←", aliases: ["gets", "arrow"] },
    { trigger: "leftrightarrow", latex: "\\leftrightarrow", glyph: "↔" },
    { trigger: "Rightarrow", latex: "\\Rightarrow", glyph: "⇒", aliases: ["implies"] },
    { trigger: "Leftarrow", latex: "\\Leftarrow", glyph: "⇐" },
    { trigger: "Leftrightarrow", latex: "\\Leftrightarrow", glyph: "⇔", aliases: ["iff"] },
    { trigger: "mapsto", latex: "\\mapsto", glyph: "↦" },
    { trigger: "uparrow", latex: "\\uparrow", glyph: "↑" },
    { trigger: "downarrow", latex: "\\downarrow", glyph: "↓" },
    { trigger: "nearrow", latex: "\\nearrow", glyph: "↗" },
    { trigger: "searrow", latex: "\\searrow", glyph: "↘" },
    { trigger: "swarrow", latex: "\\swarrow", glyph: "↙" },
    { trigger: "nwarrow", latex: "\\nwarrow", glyph: "↖" },

    // ---- Dots ----
    { trigger: "ldots", latex: "\\ldots", glyph: "…", aliases: ["dots"] },
    { trigger: "cdots", latex: "\\cdots", glyph: "⋯" },
    { trigger: "vdots", latex: "\\vdots", glyph: "⋮" },
    { trigger: "ddots", latex: "\\ddots", glyph: "⋱" },

    // ---- Misc ----
    { trigger: "hbar", latex: "\\hbar", glyph: "ℏ", aliases: ["planck"] },
    { trigger: "ell", latex: "\\ell", glyph: "ℓ" },
    { trigger: "aleph", latex: "\\aleph", glyph: "ℵ" },
    { trigger: "Re", latex: "\\Re", glyph: "ℜ" },
    { trigger: "Im", latex: "\\Im", glyph: "ℑ" },
    { trigger: "angle", latex: "\\angle", glyph: "∠" },
    { trigger: "degree", latex: "\\degree", glyph: "°" },
    { trigger: "perp", latex: "\\perp", glyph: "⊥" },
    { trigger: "parallel", latex: "\\parallel", glyph: "∥" },
    { trigger: "prime", latex: "\\prime", glyph: "′" },
    { trigger: "top", latex: "\\top", glyph: "⊤" },
    { trigger: "bot", latex: "\\bot", glyph: "⊥" },
]
