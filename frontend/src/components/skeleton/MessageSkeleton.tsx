interface MessageSkeletonProps {
	isFromMe?: boolean;
}

const MessageSkeleton = ({ isFromMe = false }: MessageSkeletonProps) => {
	return (
		<div className={`mb-6 flex gap-3 items-start ${isFromMe ? "justify-end" : "justify-start"}`}>
			{!isFromMe && (
				<div className="skeleton w-8 h-8 md:w-10 md:h-10 rounded-full shrink-0"></div>
			)}
			<div className="flex flex-col gap-2 flex-1 max-w-sm">
				<div className="skeleton h-4 w-48 md:w-64"></div>
				<div className="skeleton h-4 w-40 md:w-56"></div>
				<div className="skeleton h-3 w-24 md:w-32"></div>
			</div>
		</div>
	);
};
export default MessageSkeleton;