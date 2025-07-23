"use client";

interface StatusDisplayProps {
    status: {
        message: string;
        type: string;
    };
}

export function StatusDisplay({ status }: StatusDisplayProps) {
    if (!status.message) return null;
    
    return (
        <div id="status" className={`status ${status.type}`}>
            {status.message}
        </div>
    )
}
