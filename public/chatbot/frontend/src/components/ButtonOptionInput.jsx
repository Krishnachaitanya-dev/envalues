function ButtonOptionInput({ option, onChange, onRemove, canRemove }) {
  const buttonTextLength = option.button_text.length
  const isOverLimit = buttonTextLength > 20
  
  return (
    <div className="bg-white p-4 rounded-lg border-2 border-gray-200 hover:border-blue-300 transition-colors">
      <div className="space-y-3">
        {/* Button Label Input with Character Counter */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold text-gray-700">
              📱 Button Label (Short & Clear)
            </label>
            <span className={`text-xs font-mono ${
              isOverLimit ? 'text-red-600 font-bold' : 
              buttonTextLength > 15 ? 'text-orange-500' : 
              'text-gray-500'
            }`}>
              {buttonTextLength}/20
            </span>
          </div>
          <input
            type="text"
            value={option.button_text}
            onChange={(e) => onChange(option.id, 'button_text', e.target.value)}
            className={`w-full px-3 py-2 text-sm border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
              isOverLimit ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="e.g., Services, Pricing, Contact"
            maxLength={30}
          />
          {isOverLimit && (
            <p className="text-xs text-red-600 mt-1 font-semibold">
              ⚠️ WhatsApp limits buttons to 20 characters! Will be truncated.
            </p>
          )}
        </div>

        {/* Full Answer/Message Input */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            💬 Full Message (Rich & Detailed)
          </label>
          <textarea
            value={option.answer}
            onChange={(e) => onChange(option.id, 'answer', e.target.value)}
            rows="4"
            className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="🎉 Welcome to our services!&#10;&#10;We offer:&#10;✅ Premium quality&#10;✅ 24/7 support&#10;✅ Best prices&#10;&#10;Type 'hi' anytime to return to menu!"
          />
          <p className="text-xs text-gray-500 mt-1">
            💡 Tip: Use emojis, line breaks, and details like Kotak811! This is what customers will see.
          </p>
        </div>
      </div>

      {/* Remove Button */}
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(option.id)}
          className="mt-3 text-red-500 hover:text-red-700 text-sm font-semibold hover:bg-red-50 px-3 py-1 rounded transition-colors"
        >
          🗑️ Remove
        </button>
      )}
    </div>
  )
}

export default ButtonOptionInput