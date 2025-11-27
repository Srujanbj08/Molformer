import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiMessageSquare, FiSend, FiX } from 'react-icons/fi'
import { FaAtom, FaFlask } from 'react-icons/fa'

export default function ChemicalChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState([])
  const messagesEndRef = useRef(null)

  useEffect(() => {
    setMessages([
      {
        sender: 'bot',
        content: 'Hello! I\'m your chemistry assistant. Ask me anything about molecular structures, quantum properties, or chemical concepts!',
        timestamp: new Date()
      }
    ])
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    const userMessage = {
      sender: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    
    // Update history for API
    const newHistory = [...history, { role: 'user', content: inputValue }]
    setHistory(newHistory)
    
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await fetch('https://molformer.onrender.com/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: inputValue,
          history: newHistory
        })
      })

      if (!response.ok) throw new Error('Network response was not ok')

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Chat failed')
      }

      const botMessage = {
        sender: 'bot',
        content: data.response,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, botMessage])
      
      // Update history with bot response
      setHistory(prev => [...prev, { role: 'assistant', content: data.response }])
      
    } catch (error) {
      console.error('Error:', error)
      const errorMessage = {
        sender: 'bot',
        content: 'Sorry, I encountered an error. Please make sure the API is running and try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const formatMessage = (text) => {
    // Split by bold markers and newlines
    const lines = text.split('\n')
    return lines.map((line, i) => {
      const parts = line.split(/(\*\*.*?\*\*)/g)
      return (
        <div key={i}>
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={j}>{part.slice(2, -2)}</strong>
            }
            return part
          })}
        </div>
      )
    })
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-xl ${
          isOpen ? 'bg-indigo-600' : 'bg-gradient-to-r from-indigo-500 to-purple-600'
        }`}
      >
        {isOpen ? (
          <FiX className="text-white text-xl" />
        ) : (
          <div className="relative">
            <FiMessageSquare className="text-white text-xl" />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full"
            />
          </div>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-16 right-0 w-96 h-[500px] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-3 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FaAtom className="text-xl" />
                <h3 className="font-semibold">Chemistry Assistant</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-indigo-700">
                <FiX />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`mb-4 flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      message.sender === 'user' 
                        ? 'bg-indigo-500 text-white rounded-br-none' 
                        : 'bg-white border border-gray-200 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {message.sender === 'bot' && (
                      <div className="flex items-center mb-1">
                        <FaFlask className="text-indigo-500 mr-1 text-sm" />
                        <span className="text-xs font-medium text-indigo-600">Chemistry Bot</span>
                      </div>
                    )}
                    <div className="text-sm">
                      {formatMessage(message.content)}
                    </div>
                    <div className={`text-xs mt-1 ${message.sender === 'user' ? 'text-indigo-200' : 'text-gray-500'}`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start mb-4"
                >
                  <div className="bg-white border border-gray-200 rounded-lg rounded-bl-none p-3 shadow-sm">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="border-t border-gray-200 p-3 bg-white">
              <div className="flex items-center">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask about chemistry..."
                  className="flex-1 border border-gray-300 rounded-l-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className={`bg-indigo-600 text-white p-2 rounded-r-lg ${
                    (!inputValue.trim() || isLoading) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'
                  }`}
                >
                  <FiSend />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
