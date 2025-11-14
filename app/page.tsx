"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FormEvent, useState } from "react";

const Home = () => {
  const messages = useQuery(api.messages.get);
  const sendMessage = useMutation(api.messages.send);
  const [newMessageText, setNewMessageText] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;

    await sendMessage({ text: newMessageText });
    setNewMessageText("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <main className="w-full max-w-2xl p-8">
        <h1 className="text-3xl font-bold mb-8">Convex Hello World</h1>

        {/* Add Message Form */}
        <form onSubmit={handleSubmit} className="mb-8 flex gap-2">
          <input
            type="text"
            value={newMessageText}
            onChange={(e) => setNewMessageText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border rounded-lg"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Send
          </button>
        </form>

        {/* Messages List */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold mb-4">Messages:</h2>
          {messages === undefined ? (
            <p className="text-gray-500">Loading messages...</p>
          ) : messages.length === 0 ? (
            <p className="text-gray-500">No messages yet. Send one above!</p>
          ) : (
            messages.map((message) => (
              <div
                key={message._id}
                className="p-3 bg-gray-100 rounded-lg dark:bg-gray-800"
              >
                {message.text}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Home;
