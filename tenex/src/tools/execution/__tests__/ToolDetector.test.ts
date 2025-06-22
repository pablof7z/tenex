import { describe, it, expect, beforeEach } from "bun:test";
import { ToolDetector } from "../ToolDetector";
import type { ToolInvocation } from "@/types/tool";

describe("ToolDetector", () => {
  let detector: ToolDetector;

  beforeEach(() => {
    detector = new ToolDetector();
  });

  describe("detectTools", () => {
    it("should detect shell execute commands", () => {
      const response = `Let me check your Node version.
<execute>node --version</execute>
The Node version is displayed above.`;

      const tools = detector.detectTools(response);

      expect(tools).toHaveLength(1);
      expect(tools[0].toolName).toBe("shell");
      expect(tools[0].action).toBe("execute");
      expect(tools[0].parameters.command).toBe("node --version");
      expect(tools[0].rawMatch).toBe("<execute>node --version</execute>");
    });

    it("should detect multiple tool invocations", () => {
      const response = `I'll help you set up the project.
<execute>npm init -y</execute>
Now let's check the package.json:
<read>package.json</read>
And create a config file:
<write file="config.js">
module.exports = {
  port: 3000
};
</write>`;

      const tools = detector.detectTools(response);

      expect(tools).toHaveLength(3);
      
      expect(tools[0].toolName).toBe("shell");
      expect(tools[0].action).toBe("execute");
      
      expect(tools[1].toolName).toBe("file");
      expect(tools[1].action).toBe("read");
      expect(tools[1].parameters.path).toBe("package.json");
      
      expect(tools[2].toolName).toBe("file");
      expect(tools[2].action).toBe("write");
      expect(tools[2].parameters.path).toBe("config.js");
      expect(tools[2].parameters.content).toContain("port: 3000");
    });

    it("should handle file operations", () => {
      const response = `<read>src/index.js</read>
<write file="src/utils.js">export const helper = () => {};</write>
<edit file="src/index.js" from="// existing code" to="// existing code
import { helper } from './utils';"/>`;

      const tools = detector.detectTools(response);

      expect(tools).toHaveLength(3);
      
      expect(tools[0].action).toBe("read");
      expect(tools[0].parameters.path).toBe("src/index.js");
      
      expect(tools[1].action).toBe("write");
      expect(tools[1].parameters.path).toBe("src/utils.js");
      
      expect(tools[2].action).toBe("edit");
      expect(tools[2].parameters.path).toBe("src/index.js");
      expect(tools[2].parameters.oldContent).toBe("// existing code");
      expect(tools[2].parameters.newContent).toBe("// existing code\nimport { helper } from './utils';");
    });


    it("should handle empty responses", () => {
      const tools = detector.detectTools("");
      expect(tools).toHaveLength(0);
    });

    it("should handle responses with no tools", () => {
      const response = "This is just a regular response without any tool invocations.";
      const tools = detector.detectTools(response);
      expect(tools).toHaveLength(0);
    });

    it("should preserve tool order", () => {
      const response = `<execute>command1</execute>
<execute>command2</execute>
<execute>command3</execute>`;

      const tools = detector.detectTools(response);

      expect(tools).toHaveLength(3);
      expect(tools[0].parameters.command).toBe("command1");
      expect(tools[1].parameters.command).toBe("command2");
      expect(tools[2].parameters.command).toBe("command3");
    });

    it("should handle multiline content in tools", () => {
      const response = `<write file="test.js">
function test() {
  console.log("Line 1");
  console.log("Line 2");
  return {
    status: "ok"
  };
}
</write>`;

      const tools = detector.detectTools(response);

      expect(tools).toHaveLength(1);
      expect(tools[0].parameters.content).toContain("Line 1");
      expect(tools[0].parameters.content).toContain("Line 2");
      expect(tools[0].parameters.content).toContain('status: "ok"');
    });

    it("should handle nested quotes in parameters", () => {
      const response = `<execute>echo "Hello 'world' from test"</execute>`;

      const tools = detector.detectTools(response);

      expect(tools).toHaveLength(1);
      expect(tools[0].parameters.command).toBe('echo "Hello \'world\' from test"');
    });

    it("should handle special characters in file paths", () => {
      const response = `<read>src/components/User-Profile.tsx</read>
<write file="src/utils/@types/index.d.ts">export type User = {};</write>`;

      const tools = detector.detectTools(response);

      expect(tools).toHaveLength(2);
      expect(tools[0].parameters.path).toBe("src/components/User-Profile.tsx");
      expect(tools[1].parameters.path).toBe("src/utils/@types/index.d.ts");
    });

    it("should handle empty tool tags", () => {
      const response = `<execute></execute>
<read></read>`;

      const tools = detector.detectTools(response);

      expect(tools).toHaveLength(2);
      expect(tools[0].parameters.command).toBe("");
      expect(tools[1].parameters.path).toBe("");
    });

    it("should extract tool positions correctly", () => {
      const response = `Some text before
<execute>command1</execute>
Middle text
<execute>command2</execute>
End text`;

      const tools = detector.detectTools(response);

      // Verify tools are detected with correct content
      expect(tools[0].rawMatch).toBe("<execute>command1</execute>");
      expect(tools[1].rawMatch).toBe("<execute>command2</execute>");
    });
  });

  describe("edge cases", () => {
    it("should handle malformed tags gracefully", () => {
      const response = `<execute>command1
<read>file.txt</read>
<write file="test.js"content</write>`;

      const tools = detector.detectTools(response);

      // Should only detect the properly formed read tag
      expect(tools).toHaveLength(1);
      expect(tools[0].action).toBe("read");
    });

    it("should handle very long content", () => {
      const longContent = "x".repeat(10000);
      const response = `<write file="large.txt">${longContent}</write>`;

      const tools = detector.detectTools(response);

      expect(tools).toHaveLength(1);
      expect(tools[0].parameters.content).toHaveLength(10000);
    });

    it("should handle Unicode characters", () => {
      const response = `<write file="unicode.txt">Hello 世界 🌍</write>
<execute>echo "émojis 🎉"</execute>`;

      const tools = detector.detectTools(response);

      expect(tools).toHaveLength(2);
      // Find the write and execute tools
      const writeTools = tools.filter(t => t.action === "write");
      const executeTools = tools.filter(t => t.action === "execute");
      
      expect(writeTools[0].parameters.content).toBe("Hello 世界 🌍");
      expect(executeTools[0].parameters.command).toBe('echo "émojis 🎉"');
    });

    it("should handle Windows-style paths", () => {
      const response = `<read>C:\\Users\\test\\file.txt</read>
<write file="D:\\Projects\\app\\config.json">{}</write>`;

      const tools = detector.detectTools(response);

      expect(tools).toHaveLength(2);
      expect(tools[0].parameters.path).toBe("C:\\Users\\test\\file.txt");
      expect(tools[1].parameters.path).toBe("D:\\Projects\\app\\config.json");
    });
  });
});