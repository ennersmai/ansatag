interface ToolParameter {
  type: string;
  required: boolean;
  description: string;
}

interface Tool {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
}

export const tools: Tool[] = [
  {
    name: "Calendar",
    description: "Manage your calendar events",
    parameters: {
      action: {
        type: "string",
        required: true,
        description: "The calendar action to perform (view/create/update/delete)"
      },
      date: {
        type: "string",
        required: false,
        description: "The date for the calendar operation"
      }
    }
  },
  {
    name: "Email",
    description: "Handle your email communications",
    parameters: {
      action: {
        type: "string",
        required: true,
        description: "The email action to perform (compose/read/send)"
      },
      recipient: {
        type: "string",
        required: false,
        description: "Email recipient address"
      }
    }
  }
];

export type { Tool, ToolParameter }; 