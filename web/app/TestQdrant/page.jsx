"use client"
import { useState } from 'react';

export default function TestSolutions() {
  const [description, setDescription] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchSolutions = async () => {
    if (!description) return;
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/find-solution?description=${encodeURIComponent(description)}`);
      const data = await response.json();
      setResults(data.results);
    } catch (error) {
      console.error("Connection failed:", error);
      alert("Check if FastAPI server is running on localhost:8000");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-10 font-sans">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Dispatch Solution Tester</h1>
        
        {/* Input Section */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <label className="block text-sm font-semibold text-gray-600 mb-2">
            Incident Description
          </label>
          <textarea 
            className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-gray-700"
            rows={4}
            placeholder="e.g. Train 404 hit a tree across both tracks in light snow..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button 
            onClick={fetchSolutions}
            disabled={loading}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-md transition duration-200 disabled:bg-gray-400"
          >
            {loading ? "Searching Memory..." : "Find 3 Best Solutions"}
          </button>
        </div>

        {/* Results Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {results.map((sol, index) => (
            <div key={index} className="bg-white p-5 rounded-lg shadow border-l-4 border-blue-500">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold uppercase text-blue-600">Match #{index + 1}</span>
                <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-600">Score: {sol.score}</span>
              </div>
              <h3 className="font-bold text-lg text-gray-800 leading-tight mb-2">
                {sol.action.replace(/_/g, ' ')}
              </h3>
              <p className="text-sm text-gray-600 mb-4">{sol.detail}</p>
              <div className="pt-4 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                <span>Used {sol.times_used}x</span>
                <span className="font-semibold text-red-500">{sol.avg_delay}m delay</span>
              </div>
            </div>
          ))}
        </div>

        {results.length === 0 && !loading && (
          <p className="text-center text-gray-400 mt-10">No solutions retrieved yet. Enter a report and click search.</p>
        )}
      </div>
    </div>
  );
}