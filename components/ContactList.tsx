import React, { useState } from 'react';
import { Contact } from '../types';
import { Contact as ContactIcon, Plus, Search, Phone, Mail, MapPin, Building2 } from 'lucide-react';

interface ContactListProps {
  contacts: Contact[];
  onSave: (contact: Partial<Contact>) => Promise<void>;
}

const ContactList: React.FC<ContactListProps> = ({ contacts = [], onSave }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    organization: '',
    project: '',
    name: '',
    phone: '',
    email: '',
    station: '',
    note: ''
  });

  const filteredContacts = (contacts || []).filter(c => 
    c.name.includes(searchTerm) || c.organization.includes(searchTerm)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await onSave(formData);
    setIsLoading(false);
    setIsModalOpen(false);
    setFormData({
      organization: '',
      project: '',
      name: '',
      phone: '',
      email: '',
      station: '',
      note: ''
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h3 className="text-xl font-bold text-gray-800 flex items-center">
             <ContactIcon className="w-5 h-5 mr-2 text-green-600" />
             聯絡通訊錄
           </h3>
           <p className="text-sm text-gray-500 mt-1">管理廠商與相關單位聯繫方式 (僅管理員可見)</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm text-sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          新增聯絡人
        </button>
      </div>

      <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="搜尋姓名或單位..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-600">單位 / 負責項目</th>
                <th className="px-4 py-3 font-semibold text-gray-600">姓名</th>
                <th className="px-4 py-3 font-semibold text-gray-600">聯絡資訊</th>
                <th className="px-4 py-3 font-semibold text-gray-600">負責場域</th>
                <th className="px-4 py-3 font-semibold text-gray-600">備註</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredContacts.map(contact => (
                <tr key={contact.id} className="hover:bg-gray-50">
                   <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 flex items-center">
                        <Building2 className="w-3 h-3 mr-1 text-gray-400"/>
                        {contact.organization}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{contact.project}</div>
                   </td>
                   <td className="px-4 py-3 font-medium text-gray-800">{contact.name}</td>
                   <td className="px-4 py-3">
                      <div className="flex items-center text-gray-600 mb-1">
                        <Phone className="w-3 h-3 mr-1"/> {contact.phone}
                      </div>
                      <div className="flex items-center text-blue-600 text-xs">
                        <Mail className="w-3 h-3 mr-1"/> {contact.email}
                      </div>
                   </td>
                   <td className="px-4 py-3 text-gray-600">
                      <div className="flex items-center">
                        <MapPin className="w-3 h-3 mr-1 text-gray-400"/>
                        {contact.station}
                      </div>
                   </td>
                   <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{contact.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
             <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
               <h3 className="font-bold text-gray-800">新增聯絡人</h3>
               <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
             </div>
             <form onSubmit={handleSubmit} className="p-6 space-y-3">
               <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">所屬單位</label>
                    <input type="text" required className="w-full p-2 border rounded" 
                      value={formData.organization} onChange={e => setFormData({...formData, organization: e.target.value})} />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">負責項目</label>
                    <input type="text" className="w-full p-2 border rounded" 
                      value={formData.project} onChange={e => setFormData({...formData, project: e.target.value})} />
                 </div>
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">姓名</label>
                  <input type="text" required className="w-full p-2 border rounded" 
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">連絡電話</label>
                  <input type="text" className="w-full p-2 border rounded" 
                    value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">電子郵件</label>
                  <input type="email" className="w-full p-2 border rounded" 
                    value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">負責場域</label>
                  <input type="text" className="w-full p-2 border rounded" 
                    value={formData.station} onChange={e => setFormData({...formData, station: e.target.value})} />
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">備註</label>
                  <input type="text" className="w-full p-2 border rounded" 
                    value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} />
               </div>
               
               <div className="pt-4 flex justify-end space-x-2">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded text-gray-700 text-sm">取消</button>
                 <button type="submit" disabled={isLoading} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm">確認新增</button>
               </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactList;