import LoginForm from "@/components/Forms/LoginForm";

export const dynamic = "force-static";

export default function LoginPage() {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
            <LoginForm />
        </div>
    );
}
