import json
import os
import re


def main() -> None:
    root = os.getcwd()
    target = None
    for name in os.listdir(root):
        if name.startswith("PCA - IMAP") and "PCA (7).json" in name:
            target = os.path.join(root, name)
            break
    if not target:
        raise RuntimeError("Workflow PCA (7).json introuvable")

    with open(target, "r", encoding="utf-8") as f:
        wf = json.load(f)

    node = next((n for n in wf.get("nodes", []) if n.get("name") == "11 - Parse LLM JSON"), None)
    if not node:
        raise RuntimeError("Node 11 - Parse LLM JSON introuvable")

    code = node["parameters"]["jsCode"]

    code = code.replace(
        "const last_employer = expCount === 0 ? null : (fromCv || llmLe || null);",
        "const last_employer = expCount === 0 ? null : stripTrailingMoroccanCity(fromCv || llmLe || null);",
    )
    code = code.replace(
        "const school = cleanSchoolLabel(inferSchoolFromCv(cvText, parsed.school));",
        "const school = stripTrailingMoroccanCity(cleanSchoolLabel(inferSchoolFromCv(cvText, parsed.school)));",
    )

    if "function stripTrailingMoroccanCity(" not in code:
        anchor = "function inferSchoolType(school, rawType) {"
        helper = (
            "function stripTrailingMoroccanCity(val) {\n"
            "  let z = nsp(val);\n"
            "  if (!z) return z;\n"
            "  const city = '(casablanca|mohammedia|rabat|sale|sal[eé]|fes|f[eè]s|meknes|m[èe]knes|agadir|marrakech|tanger|tetouan|t[ée]touan|oujda|kenitra|k[eé]nitra|safi|el jadida|nador|beni mellal|b[eé]ni mellal|temara|t[ée]mara|khemisset|khouribga|guelmim|laayoune|laayoun|dakhla)';\n"
            "  z = z\n"
            "    .replace(new RegExp('\\\\s*[,\\\\-–—|]\\\\s*' + city + '\\\\s*$', 'i'), '')\n"
            "    .replace(new RegExp('\\\\s*\\\\(\\\\s*' + city + '\\\\s*\\\\)\\\\s*$', 'i'), '')\n"
            "    .replace(new RegExp(city + '\\\\s*$', 'i'), '')\n"
            "    .replace(/\\s{2,}/g, ' ')\n"
            "    .replace(/\\s*[-–|,()]+\\s*$/g, '')\n"
            "    .trim();\n"
            "  return z;\n"
            "}\n\n"
        )
        code = code.replace(anchor, helper + anchor)

    code = re.sub(
        r"function cleanSchoolLabel\(v\) \{[\s\S]*?\n\}\n\nfunction stripTrailingMoroccanCity",
        (
            "function cleanSchoolLabel(v) {\n"
            "  const s0 = nsp(v);\n"
            "  if (!s0) return '';\n"
            "  return s0\n"
            "    .replace(/\\b(cycle|fili[eè]re|g[ée]nie|licence|master|bachelor|bac|classe pr[eé]paratoire|cpge)\\b.*$/i, '')\n"
            "    .replace(/\\b(19|20)\\d{2}\\s*[-–]\\s*(actuel(?:le)?|present|présent|en\\s*cours|\\d{4})\\b/gi, '')\n"
            "    .replace(/\\b\\d{1,2}\\s*[\\/.-]\\s*(19|20)\\d{2}\\b/g, '')\n"
            "    .replace(/\\b(19|20)\\d{2}\\s*[\\/.-]\\s*\\d{1,2}\\b/g, '')\n"
            "    .replace(/\\b(19|20)\\d{2}\\s*[-–]\\s*(19|20)\\d{2}\\b/g, '')\n"
            "    .replace(/\\b(actuel(?:le)?|present|présent|en\\s*cours)\\b/gi, '')\n"
            "    .replace(/\\s*[-–|,()]+\\s*$/g, '')\n"
            "    .replace(/\\s{2,}/g, ' ')\n"
            "    .trim();\n"
            "}\n\nfunction stripTrailingMoroccanCity"
        ),
        code,
        count=1,
    )

    node["parameters"]["jsCode"] = code

    with open(target, "w", encoding="utf-8") as f:
        json.dump(wf, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    try:
        main()
        with open("workflow_city_patch.log", "w", encoding="utf-8") as log:
            log.write("ok")
    except Exception as e:
        with open("workflow_city_patch.log", "w", encoding="utf-8") as log:
            log.write(f"error: {type(e).__name__}: {e}")
        raise
