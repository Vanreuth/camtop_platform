"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
	Search,
	Send,
	MoreHorizontal,
	Phone,
	Video,
	Paperclip,
	Smile,
} from "lucide-react";
import { PermissionGuard } from "@/components/guard/PermissionGuard";

const conversations = [
	{
		id: 1,
		name: "John Doe",
		lastMessage: "Hey, how's the project going?",
		time: "2 min ago",
		unread: 2,
		avatar: "/avatar.png",
		online: true,
	},
	{
		id: 2,
		name: "Jane Smith",
		lastMessage: "Can we schedule a meeting?",
		time: "1 hour ago",
		unread: 0,
		avatar: "/avatar.png",
		online: false,
	},
	{
		id: 3,
		name: "Bob Johnson",
		lastMessage: "The files have been uploaded",
		time: "3 hours ago",
		unread: 1,
		avatar: "/avatar.png",
		online: true,
	},
];

const messages = [
	{
		id: 1,
		sender: "John Doe",
		message: "Hey, how's the project going?",
		time: "2:30 PM",
		isOwn: false,
	},
	{
		id: 2,
		sender: "You",
		message: "It's going well! We're on track to finish by Friday.",
		time: "2:32 PM",
		isOwn: true,
	},
	{
		id: 3,
		sender: "John Doe",
		message: "That's great to hear! Can you send me the latest updates?",
		time: "2:33 PM",
		isOwn: false,
	},
];

export default function MessagesPage() {
	return (
			<PermissionGuard hierarchyLevel={1} redirectTo="/dashboard">
		<div className="space-y-6">
			<div>
				<h2 className="text-3xl font-bold tracking-tight">Messages</h2>
				<p className="text-muted-foreground">
					Chat with your team and clients.
				</p>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Conversations List */}
				<Card className="lg:col-span-1">
					<CardHeader>
						<CardTitle>Conversations</CardTitle>
						<div className="relative">
							<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
							<Input placeholder="Search conversations..." className="pl-8" />
						</div>
					</CardHeader>
					<CardContent className="space-y-2">
						{conversations.map((conversation) => (
							<div
								key={conversation.id}
								className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
							>
								<div className="relative">
									<Avatar className="h-10 w-10">
										<AvatarImage
											src={conversation.avatar}
											alt={conversation.name}
										/>
										<AvatarFallback>
											{conversation.name
												.split(" ")
												.map((n) => n[0])
												.join("")}
										</AvatarFallback>
									</Avatar>
									{conversation.online && (
										<div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-white" />
									)}
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center justify-between">
										<h4 className="font-medium text-sm truncate">
											{conversation.name}
										</h4>
										<span className="text-xs text-muted-foreground">
											{conversation.time}
										</span>
									</div>
									<p className="text-sm text-muted-foreground truncate">
										{conversation.lastMessage}
									</p>
								</div>
								{conversation.unread > 0 && (
									<Badge className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
										{conversation.unread}
									</Badge>
								)}
							</div>
						))}
					</CardContent>
				</Card>

				{/* Chat Area */}
				<Card className="lg:col-span-2">
					<CardHeader>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<Avatar className="h-8 w-8">
									<AvatarImage src="/avatar.png" alt="John Doe" />
									<AvatarFallback>JD</AvatarFallback>
								</Avatar>
								<div>
									<h3 className="font-medium">John Doe</h3>
									<p className="text-sm text-muted-foreground">Online</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Button variant="ghost" size="icon">
									<Phone className="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="icon">
									<Video className="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="icon">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<div className="h-[400px] flex flex-col">
							{/* Messages */}
							<div className="flex-1 space-y-4 overflow-y-auto p-4">
								{messages.map((message) => (
									<div
										key={message.id}
										className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}
									>
										<div
											className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
												message.isOwn
													? "bg-blue-500 text-white"
													: "bg-gray-100 text-gray-900"
											}`}
										>
											<p className="text-sm">{message.message}</p>
											<p
												className={`text-xs mt-1 ${
													message.isOwn ? "text-blue-100" : "text-gray-500"
												}`}
											>
												{message.time}
											</p>
										</div>
									</div>
								))}
							</div>

							{/* Message Input */}
							<div className="border-t p-4">
								<div className="flex items-center gap-2">
									<Button variant="ghost" size="icon">
										<Paperclip className="h-4 w-4" />
									</Button>
									<Input placeholder="Type a message..." className="flex-1" />
									<Button variant="ghost" size="icon">
										<Smile className="h-4 w-4" />
									</Button>
									<Button size="icon">
										<Send className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
		</PermissionGuard>
	);
}
