export interface Model {
    name: string;
    id: string;
    type: 'chat' | 'image';
    steps?: number;
}

export const models: Model[] = [
    { name: "Deepseek R1 0528 (Chat)", id: "deepseek-ai/DeepSeek-R1-Distill-Llama-70B", type: "chat" },
    { name: "AFM-4.5B-Preview (Chat)", id: "arcee-ai/AFM-4.5B-Preview", type: "chat" },
    { name: "Meta Llama Vision Free (Chat) - DEPRECATED", id: "meta-llama/Llama-Vision-Free", type: "chat" },
    { name: "EXAONE Deep 32B (Chat)", id: "lgai/exaone-deep-32b", type: "chat" },
    { name: "EXAONE 3.5 32B Instruct (Chat)", id: "lgai/exaone-3-5-32b-instruct", type: "chat" },
    { name: "Meta Llama 3.3 70B (Chat) - DEPRECATED", id: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free", type: "chat" },
    { name: "FLUX.1-schnell-Free (Image)", id: "black-forest-labs/FLUX.1-schnell-Free", type: "image", steps: 4 }
];
