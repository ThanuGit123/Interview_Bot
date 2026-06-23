import { useState, useEffect } from 'react'
import { User, Briefcase, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateProfile } from '@/lib/services/api'
import { notifySuccess, notifyError } from '@/lib/notify'

export default function ProfileModal({ open, onOpenChange, user, onUserUpdated }) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    target_role: '',
    target_company: '',
    preferred_persona: 'default'
  })

  useEffect(() => {
    if (open && user?.profile) {
      setFormData({
        target_role: user.profile.target_role || '',
        target_company: user.profile.target_company || '',
        preferred_persona: user.profile.preferred_persona || 'default'
      })
    }
  }, [open, user])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    // setLoading(true) removed to prevent getting stuck
    try {
      const payload = {
        target_role: formData.target_role,
        target_company: formData.target_company,
        preferred_persona: formData.preferred_persona,
        years_of_experience: null
      }
      
      const updatedUser = await updateProfile(payload)
      onUserUpdated(updatedUser)
      notifySuccess('Profile updated successfully!')
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      notifyError(err, 'Failed to update profile')
      alert("Error saving profile: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg relative">
        <button 
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <User className="h-5 w-5 text-primary" />
            My AI Profile
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your targets so Caliber can personalize your mock interviews and feedback.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="target_role" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                Target Role
              </label>
              <Input
                id="target_role"
                placeholder="e.g. Frontend Engineer"
                value={formData.target_role}
                onChange={(e) => setFormData({ ...formData, target_role: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="target_company" className="flex items-center gap-2 text-sm font-medium text-foreground">
                Target Company
              </label>
              <Input
                id="target_company"
                placeholder="e.g. Google, Stripe"
                value={formData.target_company}
                onChange={(e) => setFormData({ ...formData, target_company: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="preferred_persona" className="flex items-center gap-2 text-sm font-medium text-foreground">
              Preferred Persona
            </label>
            <select
              id="preferred_persona"
              value={formData.preferred_persona}
              onChange={(e) => setFormData({ ...formData, preferred_persona: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="default">Default (Balanced)</option>
              <option value="strict">Strict / Tough</option>
              <option value="friendly">Friendly & Encouraging</option>
              <option value="direct">Direct & Analytical</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Caliber will adopt this coaching style during mock interviews.
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Save className="h-4 w-4" />
              {loading ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
