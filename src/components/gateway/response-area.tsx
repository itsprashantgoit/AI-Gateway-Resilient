"use client";

import Image from 'next/image';

interface ResponseAreaProps {
    response: any;
}

export function ResponseArea({ response }: ResponseAreaProps) {
    if (!response) return <div id="response-area" className="mt-4 p-4 border rounded-lg min-h-[100px]"></div>;

    const renderResponse = () => {
        switch (response.type) {
            case 'chat':
                return <p>{response.content}</p>;
            case 'image':
                return <Image src={`data:image/png;base64,${response.content}`} alt={response.alt} width={512} height={512} />;
            case 'error':
                return <p className="text-red-500">{response.content}</p>
            case 'boost':
                return (
                    <div>
                        {response.results.map((result: any, index: number) => {
                             const request = response.requests[index];
                             return (
                                <div key={index} className="mb-4 p-4 border rounded-lg shadow-md">
                                    <p className="font-bold text-green-600 border-b pb-2 mb-2 font-mono">
                                        Prompt: "{request.prompt}" (Model: {request.model})
                                    </p>
                                    <div>
                                        {result.status === 'fulfilled' ? (
                                            request.type === 'chat' ? (
                                                <p>{result.value.choices[0].message.content}</p>
                                            ) : (
                                                result.value.data && result.value.data[0] && result.value.data[0].b64_json ? (
                                                    <Image src={`data:image/png;base64,${result.value.data[0].b64_json}`} alt={request.prompt} width={256} height={256} className="max-w-full rounded-md mt-2" />
                                                ) : <p className="text-red-500">Error: Image data not found.</p>
                                            )
                                        ) : (
                                            <p className="text-red-500">
                                                Failed to process prompt: {result.reason?.message || JSON.stringify(result.reason)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                             )
                        })}
                    </div>
                );

            default:
                return null;
        }
    }

    return (
        <div id="response-area" className="mt-4 p-4 border rounded-lg min-h-[100px] bg-gray-50">
           {renderResponse()}
        </div>
    )
}
