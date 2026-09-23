import { describe, it, expect } from "vitest";
import { parseDelimitedValues } from "../../web/src/lib/delimited.js";

describe("TagInput & parseDelimitedValues — Technologies & Skills Parsing", () => {
  describe("Technology Input Requirements (Bug #2)", () => {
    it("1. handles single technology + Enter", () => {
      let tags: string[] = [];
      tags = [...tags, ...parseDelimitedValues("React", tags)];
      expect(tags).toEqual(["React"]);
      tags = [...tags, ...parseDelimitedValues("Node.js", tags)];
      expect(tags).toEqual(["React", "Node.js"]);
    });

    it("2. handles multiple comma-separated technologies", () => {
      const result = parseDelimitedValues("React, Node.js, PostgreSQL, Docker");
      expect(result).toEqual(["React", "Node.js", "PostgreSQL", "Docker"]);
    });

    it("3. handles comma followed by multiple spaces", () => {
      const result = parseDelimitedValues("React,   Node.js,    PostgreSQL");
      expect(result).toEqual(["React", "Node.js", "PostgreSQL"]);
    });

    it("4. handles pasted comma-separated technologies without spaces", () => {
      const result = parseDelimitedValues("React,Node.js,PostgreSQL,Docker");
      expect(result).toEqual(["React", "Node.js", "PostgreSQL", "Docker"]);
    });

    it("5. handles mixed comma and Enter/newline input", () => {
      const result = parseDelimitedValues("React, Node.js\nPostgreSQL\r\nDocker");
      expect(result).toEqual(["React", "Node.js", "PostgreSQL", "Docker"]);
    });

    it("6. removes empty comma values and trailing commas", () => {
      const result = parseDelimitedValues("React, Node.js, , PostgreSQL,");
      expect(result).toEqual(["React", "Node.js", "PostgreSQL"]);
    });

    it("7. deduplicates accidental duplicate entries (case-insensitive) while preserving original casing", () => {
      const batchResult = parseDelimitedValues("React, Node.js, react, NODE.JS, Docker");
      expect(batchResult).toEqual(["React", "Node.js", "Docker"]);

      const incrementalResult = parseDelimitedValues("node.js, TypeScript", ["React", "Node.js"]);
      expect(incrementalResult).toEqual(["TypeScript"]);
    });

    it("8. preserves technologies containing internal spaces as a single item", () => {
      const result = parseDelimitedValues(
        "React Native, Machine Learning, Scikit Learn, Power BI",
      );
      expect(result).toEqual([
        "React Native",
        "Machine Learning",
        "Scikit Learn",
        "Power BI",
      ]);
      expect(result).toHaveLength(4);
    });

    it("9. preserves technologies containing punctuation as a single item", () => {
      const result = parseDelimitedValues("Node.js, Next.js, C++, C#, Vue.js");
      expect(result).toEqual(["Node.js", "Next.js", "C++", "C#", "Vue.js"]);
      expect(result).toHaveLength(5);
    });

    it("10. preserves remove and edit array operations on string[]", () => {
      let technologies = parseDelimitedValues("React, Node.js, PostgreSQL, Docker");
      // Remove index 1 ("Node.js")
      technologies = technologies.filter((_: string, i: number) => i !== 1);
      expect(technologies).toEqual(["React", "PostgreSQL", "Docker"]);

      // Backspace removes last tag
      technologies = technologies.slice(0, -1);
      expect(technologies).toEqual(["React", "PostgreSQL"]);

      // Edit index 0 ("React" -> "React Native")
      const remaining = technologies.filter((_: string, i: number) => i !== 0);
      technologies = [...remaining, ...parseDelimitedValues("React Native", remaining)];
      expect(technologies).toEqual(["PostgreSQL", "React Native"]);
    });
  });

  describe("Skills Input Requirements (Bug #3)", () => {
    it("1. parses comma-separated skills into separate items", () => {
      const result = parseDelimitedValues(
        "Python, SQL, Pandas, NumPy, TensorFlow, LangChain",
      );
      expect(result).toEqual([
        "Python",
        "SQL",
        "Pandas",
        "NumPy",
        "TensorFlow",
        "LangChain",
      ]);
      expect(result).toHaveLength(6);
    });

    it("2. supports Python + Enter + SQL as two separate skills", () => {
      let skills: string[] = [];
      skills = [...skills, ...parseDelimitedValues("Python", skills)];
      skills = [...skills, ...parseDelimitedValues("SQL", skills)];
      expect(skills).toEqual(["Python", "SQL"]);
    });

    it("3. supports mixed comma + Enter skills input", () => {
      const input = `Python, SQL
Pandas, NumPy
TensorFlow`;
      const result = parseDelimitedValues(input);
      expect(result).toEqual([
        "Python",
        "SQL",
        "Pandas",
        "NumPy",
        "TensorFlow",
      ]);
    });

    it("4. preserves multi-word skills like 'Machine Learning' as a single skill", () => {
      const result = parseDelimitedValues(
        "Machine Learning, Deep Learning, Natural Language Processing",
      );
      expect(result).toEqual([
        "Machine Learning",
        "Deep Learning",
        "Natural Language Processing",
      ]);
      expect(result).toHaveLength(3);
    });
  });
});
