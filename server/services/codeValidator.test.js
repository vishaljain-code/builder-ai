import assert from "node:assert/strict";
import test from "node:test";
import { validateAndFixCode, validateRevisionContent } from "./codeValidator.js";

test("repairs malformed JSX comments during file generation", () => {
    const result = validateAndFixCode(
        "function Footer() {\n  return <footer>{/* Brand -->**<div>Brand</div></footer>;\n}",
        "/components/Footer.js",
    );

    assert.match(result.code, /\{\/\* Brand \*\/\}/);
    assert.ok(result.warnings.includes("/components/Footer.js: Fixed malformed JSX comment"));
});

test("repairs malformed JSX comments in revision replacements", () => {
    const result = validateRevisionContent(
        "{/* Brand -->**<div>Brand</div>",
        "/components/Footer.js",
        "update",
    );

    assert.match(result.content, /^\{\/\* Brand \*\/\}/);
    assert.ok(result.warnings.includes("/components/Footer.js: Fixed malformed JSX comment"));
});
