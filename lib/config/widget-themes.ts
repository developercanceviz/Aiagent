export interface WidgetTheme {
  key: string;
  label: string;
  primaryColor: string;
  headerBg: string;
  headerText: string;
  userMsgColor: string;
  botMsgColor: string;
  bubbleColor: string;
  bubbleIcon: string;
  swatch: [string, string];
}

export const widgetThemes: WidgetTheme[] = [
  {
    key: "creato",
    label: "Creato",
    primaryColor: "#14DAAA",
    headerBg: "#101216",
    headerText: "#FFFFFF",
    userMsgColor: "#14DAAA",
    botMsgColor: "#F4F4F5",
    bubbleColor: "#14DAAA",
    bubbleIcon: "#101216",
    swatch: ["#14DAAA", "#101216"],
  },
  {
    key: "royalBlue",
    label: "Royal Blue",
    primaryColor: "#3B82F6",
    headerBg: "#101216",
    headerText: "#FFFFFF",
    userMsgColor: "#3B82F6",
    botMsgColor: "#F4F4F5",
    bubbleColor: "#3B82F6",
    bubbleIcon: "#101216",
    swatch: ["#3B82F6", "#101216"],
  },
  {
    key: "sunset",
    label: "Sunset",
    primaryColor: "#F97316",
    headerBg: "#101216",
    headerText: "#FFFFFF",
    userMsgColor: "#F97316",
    botMsgColor: "#F4F4F5",
    bubbleColor: "#F97316",
    bubbleIcon: "#101216",
    swatch: ["#F97316", "#101216"],
  },
  {
    key: "rose",
    label: "Rose",
    primaryColor: "#F43F5E",
    headerBg: "#101216",
    headerText: "#FFFFFF",
    userMsgColor: "#F43F5E",
    botMsgColor: "#F4F4F5",
    bubbleColor: "#F43F5E",
    bubbleIcon: "#101216",
    swatch: ["#F43F5E", "#101216"],
  },
  {
    key: "purple",
    label: "Purple",
    primaryColor: "#8B5CF6",
    headerBg: "#101216",
    headerText: "#FFFFFF",
    userMsgColor: "#8B5CF6",
    botMsgColor: "#F4F4F5",
    bubbleColor: "#8B5CF6",
    bubbleIcon: "#101216",
    swatch: ["#8B5CF6", "#101216"],
  },
  {
    key: "emerald",
    label: "Emerald",
    primaryColor: "#10B981",
    headerBg: "#101216",
    headerText: "#FFFFFF",
    userMsgColor: "#10B981",
    botMsgColor: "#F4F4F5",
    bubbleColor: "#10B981",
    bubbleIcon: "#101216",
    swatch: ["#10B981", "#101216"],
  },
];
