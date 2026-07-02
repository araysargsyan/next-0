import LoginForm from "@/components/Forms/LoginForm";

export const dynamic = "force-static";

export default function LoginPage() {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
            <div className='p-8 bg-white rounded-2xl shadow-lg border border-gray-100 w-1/4 min-w-[320px]'>
                <LoginForm />
            </div>
        </div>
    );
}
