'use client';

import { type ChangeEvent, type FormEvent, useRef, useState } from 'react';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import ArticleIcon from '@mui/icons-material/Article';
import TableChartIcon from '@mui/icons-material/TableChart';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import { useBillContext } from '@/components/shared/bill-context';
import type { Bill } from '@/components/shared/types';

interface ChatPanelProps {
  onClose: () => void;
}

export default function ChatPanel({ onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Array<{ id: number; role: 'user' | 'assistant'; content: string; files?: File[] }>>([
    {
      id: 1,
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. I can help you analyze your energy consumption, detect anomalies, and answer questions about your bills. You can upload your MERALCO bills here and I\'ll extract and summarize the data for you. The information will be saved to your Bills tab for future reference. How can I assist you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadedBills, setUploadedBills } = useBillContext();

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.startsWith('image/')) return <ImageIcon sx={{ fontSize: 16 }} />;
    if (type === 'application/pdf') return <DescriptionIcon sx={{ fontSize: 16 }} />;
    if (type.includes('word') || type.includes('document')) return <ArticleIcon sx={{ fontSize: 16 }} />;
    if (type.includes('sheet') || type.includes('excel')) return <TableChartIcon sx={{ fontSize: 16 }} />;
    return <AttachFileIcon sx={{ fontSize: 16 }} />;
  };

  const handleSendMessage = async (e: FormEvent<HTMLFormElement>, customMessage?: string) => {
    e.preventDefault();
    const messageContent = customMessage || input;
    if (!messageContent.trim() && selectedFiles.length === 0) return;

    const userMessage = {
      id: messages.length + 1,
      role: 'user' as const,
      content: messageContent,
      files: selectedFiles.length > 0 ? selectedFiles : undefined,
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    const billFiles = selectedFiles.filter(
      f =>
        f.type.startsWith('image/') ||
        f.type === 'application/pdf' ||
        f.name.toLowerCase().includes('bill') ||
        f.name.toLowerCase().includes('meralco')
    );

    setSelectedFiles([]);
    setIsLoading(true);

    setTimeout(() => {
      let responseContent = 'I understand. I\'m analyzing your data.';

      if (billFiles.length > 0) {
        const fileNames = billFiles.map(f => f.name).join(', ');

        billFiles.forEach((file, fileIdx) => {
          const newBill: Bill = {
            id: uploadedBills.length + fileIdx + 1,
            name: file.name.replace(/\.[^/.]+$/, '') || 'MERALCO Bill',
            status: 'completed',
            uploadDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            ocrConfidence: 88 + Math.random() * 10,
            extractedData: {
              accountDetails: {
                accountNumber: '123-456-7890',
                customerName: 'Juan Dela Cruz',
                serviceAddress: '123 Main Street, Manila, 1000',
                meterNumber: 'M-2026-001',
                confidence: 95,
              },
              billingPeriod: {
                startDate: 'Apr 15, 2026',
                endDate: 'May 14, 2026',
                daysInPeriod: 30,
                readingDate: 'May 14, 2026',
                confidence: 98,
              },
              consumption: {
                previousReading: 12641,
                currentReading: 12832,
                totalkWh: 191,
                unit: 'kWh',
                confidence: 97,
              },
              charges: [
                { description: 'Generation', amount: 1140.5, confidence: 94 },
                { description: 'Transmission', amount: 185.75, confidence: 92 },
                { description: 'Distribution', amount: 125.3, confidence: 91 },
                { description: 'System Loss', amount: 45.5, confidence: 89 },
                { description: 'Metering', amount: 15.0, confidence: 95 },
              ],
              totalAmount: 1482.05,
              dueDate: 'Jun 5, 2026',
              confidence: 96,
            },
          };
          setUploadedBills(prev => [...prev, newBill]);
        });

        responseContent = `I've successfully analyzed your bill(s): ${fileNames}\n\nAnalysis Summary:\n• Consumption: 191 kWh\n• Previous Reading: 12,641\n• Current Reading: 12,832\n• Total Amount Due: ₱1,482.05\n• Due Date: Jun 5, 2026\n\nThe extracted data has been saved to your Bills tab. You can review all details there.`;
      } else {
        responseContent = 'I understand. I\'m analyzing your energy data. This is a placeholder response. In a real implementation, this would connect to your AI backend service to provide intelligent insights about your consumption patterns.';
      }

      const botMessage = {
        id: messages.length + 2,
        role: 'assistant' as const,
        content: responseContent,
      };
      setMessages(prev => [...prev, botMessage]);
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
        <h2 className="text-lg font-semibold text-white">AI Assistant</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 transition-colors text-2xl leading-none"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
        {messages.map(message => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-xs">
              <div className={`px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-white rounded-br-none'
                  : 'bg-slate-700/50 text-slate-100 border border-slate-600/50 rounded-bl-none'
              }`}>
                <p className="text-sm whitespace-pre-line">{message.content}</p>
              </div>
              {message.files && message.files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {message.files.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/30 rounded-lg border border-slate-600/50 text-xs text-slate-300">
                      <span>{getFileIcon(file)}</span>
                      <span className="truncate">{file.name}</span>
                      <span className="text-slate-500">({(file.size / 1024).toFixed(1)}KB)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-700/50 text-slate-100 border border-slate-600/50 px-4 py-2 rounded-lg rounded-bl-none">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-700/50 bg-slate-800/50 p-4 space-y-3">
        {messages.length <= 1 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={e => handleSendMessage(e as any, 'Analyze my energy consumption patterns and give recommendations')}
              className="w-full px-4 py-3 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/50 hover:border-slate-500/70 text-slate-300 hover:text-slate-100 text-sm rounded-lg transition-all flex items-center justify-between group"
            >
              <span>Analyze my consumption</span>
              <span className="text-slate-500 group-hover:text-slate-400 transition-colors">↓</span>
            </button>
            <button
              type="button"
              onClick={e => handleSendMessage(e as any, 'Analyze my MERALCO bill and explain the charges')}
              className="w-full px-4 py-3 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/50 hover:border-slate-500/70 text-slate-300 hover:text-slate-100 text-sm rounded-lg transition-all flex items-center justify-between group"
            >
              <span>Analyze my MERALCO bill</span>
              <span className="text-slate-500 group-hover:text-slate-400 transition-colors">↓</span>
            </button>
            <button
              type="button"
              onClick={e => handleSendMessage(e as any, 'What are the best ways to reduce my energy costs?')}
              className="w-full px-4 py-3 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/50 hover:border-slate-500/70 text-slate-300 hover:text-slate-100 text-sm rounded-lg transition-all flex items-center justify-between group"
            >
              <span>Energy-saving tips</span>
              <span className="text-slate-500 group-hover:text-slate-400 transition-colors">↓</span>
            </button>
          </div>
        )}

        {selectedFiles.length > 0 && (
          <div className="space-y-2 pb-2 border-b border-slate-700/50">
            <p className="text-xs text-slate-400">Attached files ({selectedFiles.length}):</p>
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700/50 rounded-lg border border-slate-600/50 text-xs text-slate-300 hover:border-cyan-500/50 transition-all">
                  <span>{getFileIcon(file)}</span>
                  <span className="max-w-[100px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="text-slate-500 hover:text-red-400 transition-colors ml-1"
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-700/50 space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center w-10 h-10 flex-shrink-0 bg-slate-700/50 hover:bg-slate-700/70 border border-slate-600/50 hover:border-purple-500/50 text-slate-300 hover:text-purple-300 rounded-lg transition-all"
            title="Attach files"
          >
            +
          </button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask me anything..."
            className="flex-1 px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || (!input.trim() && selectedFiles.length === 0)}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 disabled:from-slate-600 disabled:to-slate-600 text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 disabled:shadow-none flex-shrink-0"
          >
            Send
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          className="hidden"
        />
      </form>
    </div>
  );
}
