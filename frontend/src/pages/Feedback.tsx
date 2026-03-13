import React, { useState } from 'react';
import { Star, Send, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { feedbackAPI } from '../services/api';
import clsx from 'clsx';

const Feedback: React.FC = () => {
    const [formData, setFormData] = useState({
        category: 'suggestion',
        subject: '',
        content: '',
        rating: 5
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        try {
            await feedbackAPI.submit(formData);
            setIsSuccess(true);
            setFormData({ category: 'suggestion', subject: '', content: '', rating: 5 });
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to submit feedback');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Help us improve</h1>
                    <p className="text-gray-500">Share your thoughts, report problems, or give us a review. Your feedback goes directly to our administration team.</p>
                </div>
                <div className="absolute -top-10 -right-10 h-40 w-40 bg-primary-50 rounded-full blur-3xl opacity-50"></div>
            </div>

            {isSuccess ? (
                <div className="bg-green-50 border border-green-100 p-10 rounded-3xl text-center">
                    <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                        <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank you!</h2>
                    <p className="text-gray-600 mb-8">Your feedback has been submitted successfully. We appreciate your input!</p>
                    <button
                        onClick={() => setIsSuccess(false)}
                        className="bg-white text-gray-600 px-6 py-2 rounded-xl border border-gray-200 font-bold hover:bg-gray-50 transition-colors"
                    >
                        Send Another
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl shadow-lg border border-gray-50 space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center text-sm border border-red-100">
                            <AlertCircle className="h-5 w-5 mr-2" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
                            <select
                                className="w-full bg-gray-50 border-transparent focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 rounded-xl p-3 text-sm transition-all"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            >
                                <option value="suggestion">💡 Suggestion</option>
                                <option value="complaint">🚩 Problem/Complaint</option>
                                <option value="review">⭐ Review</option>
                                <option value="other">❓ Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Rating</label>
                            <div className="flex items-center space-x-2 bg-gray-50 rounded-xl p-2 border border-transparent">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, rating: star })}
                                        className={clsx(
                                            "p-1 transition-colors",
                                            formData.rating >= star ? "text-amber-400" : "text-gray-200"
                                        )}
                                    >
                                        <Star className={clsx("h-6 w-6", formData.rating >= star ? "fill-current" : "")} />
                                    </button>
                                ))}
                                <span className="text-xs font-bold text-gray-400 ml-2">{formData.rating}/5</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Subject</label>
                        <input
                            required
                            type="text"
                            className="w-full bg-gray-50 border-transparent focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 rounded-xl p-3 text-sm transition-all"
                            placeholder="Briefly describe what this is about"
                            value={formData.subject}
                            onChange={e => setFormData({ ...formData, subject: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Message</label>
                        <textarea
                            required
                            rows={5}
                            className="w-full bg-gray-50 border-transparent focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 rounded-xl p-3 text-sm transition-all"
                            placeholder="Tell us more details..."
                            value={formData.content}
                            onChange={e => setFormData({ ...formData, content: e.target.value })}
                        ></textarea>
                    </div>

                    <div className="flex items-center space-x-2 text-xs text-gray-400 bg-gray-50/50 p-4 rounded-xl border border-dashed border-gray-200">
                        <Info className="h-4 w-4" />
                        <p>Your feedback is confidential and will be reviewed by authorized administrators only.</p>
                    </div>

                    <button
                        disabled={isSubmitting}
                        type="submit"
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-primary-200 transition-all flex items-center justify-center disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                            <>
                                <Send className="h-5 w-5 mr-3" />
                                Submit Feedback
                            </>
                        )}
                    </button>
                </form>
            )}
        </div>
    );
};

export default Feedback;
